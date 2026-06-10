import { useState, useEffect, useCallback } from "react";
import type { ProductivityRule, TimeLimitRule, ProductivityCategory } from "../../types/tracking";
import type { RuntimeMessage } from "../../types/tracking";
import { validateProductivityRule } from "../analytics/productivity-rules";

export function useProductivityRules(activeTab: string, onRulesChanged: () => void) {
  const [customRules, setCustomRules] = useState<ProductivityRule[]>([]);
  const [defaultRules, setDefaultRules] = useState<ProductivityRule[]>([]);
  const [timeLimitRules, setTimeLimitRules] = useState<TimeLimitRule[]>([]);
  const [isQuickClassifyMode, setIsQuickClassifyMode] = useState(false);
  const [quickClassifications, setQuickClassifications] = useState<Record<string, ProductivityCategory>>({});

  const fetchRules = useCallback(() => {
    chrome.runtime.sendMessage(
      { type: "GET_PRODUCTIVITY_RULES", version: 1 } as RuntimeMessage,
      (response: { success: boolean; customRules?: ProductivityRule[]; defaultRules?: ProductivityRule[]; error?: string }) => {
        if (response && response.success) {
          setCustomRules(response.customRules ?? []);
          setDefaultRules(response.defaultRules ?? []);
        }
      }
    );
    chrome.runtime.sendMessage(
      { type: "GET_TIME_LIMIT_RULES", version: 1 } as RuntimeMessage,
      (res: { success: boolean; rules?: TimeLimitRule[] }) => {
        if (res && res.success) {
          setTimeLimitRules(res.rules ?? []);
        }
      }
    );
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules, activeTab]);

  const handleAddCustomRule = (candidateRule: ProductivityRule): Promise<{success: boolean, error?: string}> => {
    return new Promise((resolve) => {
      const validationError = validateProductivityRule(candidateRule);
      if (validationError) {
        resolve({ success: false, error: validationError });
        return;
      }

      const updatedRules = customRules.filter(r => r.domain !== candidateRule.domain);
      updatedRules.push(candidateRule);

      chrome.runtime.sendMessage(
        {
          type: "SAVE_PRODUCTIVITY_RULES",
          version: 1,
          rules: updatedRules
        } as RuntimeMessage,
        (res: { success: boolean; error?: string }) => {
          if (res && res.success) {
            setCustomRules(updatedRules);
            onRulesChanged();
            resolve({ success: true });
          } else {
            resolve({ success: false, error: res?.error ?? "Failed to save rule in storage." });
          }
        }
      );
    });
  };

  const handleSaveQuickClassifications = (): Promise<{success: boolean, error?: string}> => {
    return new Promise((resolve) => {
      const domains = Object.keys(quickClassifications);
      if (domains.length === 0) {
        setIsQuickClassifyMode(false);
        resolve({ success: true });
        return;
      }

      let updatedRules = [...customRules];
      domains.forEach(domain => {
        const category = quickClassifications[domain];
        updatedRules = updatedRules.filter(r => r.domain !== domain);
        updatedRules.push({
          domain,
          category: category!,
          priority: 1,
          createdAt: Date.now()
        });
      });

      chrome.runtime.sendMessage(
        {
          type: "SAVE_PRODUCTIVITY_RULES",
          version: 1,
          rules: updatedRules
        } as RuntimeMessage,
        (res: { success: boolean; error?: string }) => {
          if (res && res.success) {
            setCustomRules(updatedRules);
            setQuickClassifications({});
            setIsQuickClassifyMode(false);
            onRulesChanged();
            resolve({ success: true });
          } else {
            resolve({ success: false, error: res?.error ?? "Failed to save quick classifications." });
          }
        }
      );
    });
  };

  const handleDeleteRule = (domain: string) => {
    const updatedRules = customRules.filter(r => r.domain !== domain);

    chrome.runtime.sendMessage(
      {
        type: "SAVE_PRODUCTIVITY_RULES",
        version: 1,
        rules: updatedRules
      } as RuntimeMessage,
      (res: { success: boolean; error?: string }) => {
        if (res && res.success) {
          setCustomRules(updatedRules);
          onRulesChanged();
        } else {
          alert(res?.error ?? "Failed to delete custom rule.");
        }
      }
    );
  };

  const handleResetRules = () => {
    if (!confirm("Are you sure you want to reset all custom rules? This restores the built-in catalog defaults.")) return;
    
    chrome.runtime.sendMessage(
      { type: "RESET_PRODUCTIVITY_RULES", version: 1 } as RuntimeMessage,
      (res: { success: boolean; error?: string }) => {
        if (res && res.success) {
          setCustomRules([]);
          onRulesChanged();
        } else {
          alert(res?.error ?? "Failed to reset rules.");
        }
      }
    );
  };

  const handleExportRules = () => {
    const payload = JSON.stringify({
      schema: "web-swap-productivity-rules",
      version: 1,
      exportedAt: Date.now(),
      rules: customRules,
      timeLimits: timeLimitRules
    }, null, 2);

    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `web_swap_custom_rules_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportRulesFile = (file: File): Promise<{success: boolean, error?: string}> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const rawJson = event.target?.result as string;
          const parsed = JSON.parse(rawJson);

          if (parsed.schema !== "web-swap-productivity-rules" || parsed.version !== 1) {
            resolve({ success: false, error: "Invalid schema file. Must be a valid web-swap rules configuration." });
            return;
          }

          const importedRules: ProductivityRule[] = [];
          if (Array.isArray(parsed.rules)) {
            for (const rule of parsed.rules) {
              const check = validateProductivityRule(rule);
              if (check) {
                resolve({ success: false, error: `Validation failed for category rule '${rule?.domain}': ${check}` });
                return;
              }
              importedRules.push({
                domain: rule.domain,
                category: rule.category,
                priority: rule.priority,
                createdAt: rule.createdAt ?? Date.now()
              });
            }
          }

          const importedTimeLimits: TimeLimitRule[] = [];
          if (Array.isArray(parsed.timeLimits)) {
            for (const limit of parsed.timeLimits) {
              if (!limit.domain || typeof limit.domain !== "string") {
                resolve({ success: false, error: "Validation failed for time limit: missing/invalid domain" });
                return;
              }
              if (typeof limit.maxDurationMs !== "number" || limit.maxDurationMs <= 0) {
                resolve({ success: false, error: `Validation failed for time limit on '${limit.domain}': invalid duration` });
                return;
              }
              importedTimeLimits.push({
                domain: limit.domain,
                maxDurationMs: limit.maxDurationMs,
                createdAt: limit.createdAt ?? Date.now(),
                enabled: limit.enabled ?? true
              });
            }
          }

          if (confirm(`Importing ${importedRules.length} category rules and ${importedTimeLimits.length} time limits. Overwrite existing rules?`)) {
            chrome.runtime.sendMessage(
              { type: "SAVE_PRODUCTIVITY_RULES", version: 1, rules: importedRules },
              (res: { success: boolean; error?: string }) => {
                if (res && res.success) {
                  setCustomRules(importedRules);
                  
                  chrome.runtime.sendMessage(
                    { type: "SAVE_TIME_LIMIT_RULES", version: 1, rules: importedTimeLimits },
                    (resTL: { success: boolean; error?: string }) => {
                      if (resTL && resTL.success) {
                        setTimeLimitRules(importedTimeLimits);
                        onRulesChanged();
                        resolve({ success: true });
                      } else {
                        resolve({ success: false, error: resTL?.error ?? "Failed to save imported time limits." });
                      }
                    }
                  );
                } else {
                  resolve({ success: false, error: res?.error ?? "Failed to save imported category rules." });
                }
              }
            );
          } else {
             resolve({ success: false, error: "Import cancelled." });
          }
        } catch (err) {
          resolve({ success: false, error: "Failed to parse JSON file structure. Verify the file contents." });
        }
      };
      reader.readAsText(file);
    });
  };

  const handleAddTimeLimit = (domain: string, durationMins: number): Promise<{success: boolean, error?: string}> => {
    return new Promise((resolve) => {
      if (!domain || isNaN(durationMins) || durationMins < 1) {
        resolve({ success: false, error: "Valid domain and duration > 0 required." });
        return;
      }
      const maxDurationMs = durationMins * 60 * 1000;
      const newRule: TimeLimitRule = { domain, maxDurationMs, createdAt: Date.now() };
      const updated = [...timeLimitRules.filter(r => r.domain !== domain), newRule];
      chrome.runtime.sendMessage({ type: "SAVE_TIME_LIMIT_RULES", version: 1, rules: updated }, (res) => {
        if (chrome.runtime.lastError) {
          resolve({ success: false, error: "Connection error: " + chrome.runtime.lastError.message });
          return;
        }
        if (res && res.success) {
          setTimeLimitRules(updated);
          resolve({ success: true });
        } else {
          resolve({ success: false, error: res?.error || "Failed to save time limit rule." });
        }
      });
    });
  };

  const handleDeleteTimeLimit = (domain: string) => {
    const updated = timeLimitRules.filter(r => r.domain !== domain);
    chrome.runtime.sendMessage({ type: "SAVE_TIME_LIMIT_RULES", version: 1, rules: updated }, (res) => {
      if (res && res.success) {
        setTimeLimitRules(updated);
      }
    });
  };

  const handleToggleTimeLimit = (domain: string) => {
    const updated = timeLimitRules.map(r => 
      r.domain === domain ? { ...r, enabled: r.enabled === false ? true : false } : r
    );
    chrome.runtime.sendMessage({ type: "SAVE_TIME_LIMIT_RULES", version: 1, rules: updated }, (res) => {
      if (res && res.success) {
        setTimeLimitRules(updated);
      }
    });
  };

  return {
    customRules,
    defaultRules,
    timeLimitRules,
    fetchRules,
    isQuickClassifyMode,
    setIsQuickClassifyMode,
    quickClassifications,
    setQuickClassifications,
    handleAddCustomRule,
    handleSaveQuickClassifications,
    handleDeleteRule,
    handleResetRules,
    handleExportRules,
    handleImportRulesFile,
    handleAddTimeLimit,
    handleDeleteTimeLimit,
    handleToggleTimeLimit
  };
}
