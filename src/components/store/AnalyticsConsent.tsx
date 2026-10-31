import { useEffect, useId, useState } from "react";
import { useLocation } from "@/lib/navigation";
import { initializeAnalytics, prepareAnalyticsNavigation, readAnalyticsConsent, saveAnalyticsConsent, syncAnalyticsPage, type AnalyticsConfig } from "../../lib/analytics";
import { useStorefrontConfig } from "../../lib/storefront-config";
import { canShowOfferOnPath } from "../../lib/promotion-visibility";

export function AnalyticsConsent() {
  const { analyticsPromptEnabled } = useStorefrontConfig();
  const pathname = useLocation().pathname;
  const [visible, setVisible] = useState(false);
  const [manuallyOpened, setManuallyOpened] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [advertising, setAdvertising] = useState(false);
  const [canClose, setCanClose] = useState(false);
  const [error, setError] = useState("");
  const [providers, setProviders] = useState<AnalyticsConfig>({});
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsId = useId();
  const hasAnalytics = Boolean(providers.ga4MeasurementId || providers.clarityProjectId);
  const hasAdvertising = Boolean(providers.metaPixelId);
  useEffect(() => {
    const current = readAnalyticsConsent();
    setAnalytics(current?.analytics || false);
    setAdvertising(current?.advertising || false);
    setCanClose(Boolean(current));
    const open = () => {
      const choice = readAnalyticsConsent();
      setAnalytics(choice?.analytics || false);
      setAdvertising(choice?.advertising || false);
      setCanClose(Boolean(choice));
      setSettingsOpen(true);
      setManuallyOpened(true);
      setVisible(true);
    };
    window.addEventListener("avaruchi:analytics-preferences", open);
    const beforeHistory = () => prepareAnalyticsNavigation(window.location.href);
    window.addEventListener("popstate", beforeHistory, true);
    let mounted = true;
    void initializeAnalytics().then(config => { if (mounted) setProviders(config); });
    return () => { mounted = false; window.removeEventListener("avaruchi:analytics-preferences", open); window.removeEventListener("popstate", beforeHistory, true); };
  }, []);
  useEffect(() => {
    if (!manuallyOpened) setVisible(!dismissed && analyticsPromptEnabled && (hasAnalytics || hasAdvertising) && canShowOfferOnPath(pathname) && !readAnalyticsConsent());
  }, [analyticsPromptEnabled, hasAnalytics, hasAdvertising, manuallyOpened, pathname, dismissed]);
  useEffect(() => { syncAnalyticsPage(); }, [pathname]);
  const save = (choice: { analytics: boolean; advertising: boolean }) => {
    if (saveAnalyticsConsent({ analytics: hasAnalytics && choice.analytics, advertising: hasAdvertising && choice.advertising })) { setVisible(false); setManuallyOpened(false); setCanClose(true); setError(""); }
    else setError("Your browser could not save this choice. Optional tracking remains off.");
  };
  if (!visible) return null;
  return <aside className="analytics-consent" aria-label="Cookie and tracking preferences" data-clarity-mask="true">
    <div className="analytics-consent-heading"><h2>Your privacy choices</h2>{(canClose || manuallyOpened) && <button type="button" className="analytics-consent-close" aria-label="Close privacy preferences" onClick={() => { setVisible(false); setDismissed(true); setManuallyOpened(false); }}>×</button>}</div>
    <p>Essential storage supports sign-in and your basket. {canClose ? "You can update your optional tracking choices." : "Optional tracking stays off until you choose."}</p>
    <div id={settingsId} className="analytics-consent-settings" hidden={!settingsOpen}>
    <p>{hasAnalytics && <>{providers.ga4MeasurementId && providers.clarityProjectId ? "Google Analytics and Microsoft Clarity help" : providers.ga4MeasurementId ? "Google Analytics helps" : "Microsoft Clarity helps"} us understand shopping with your permission. </>}{hasAdvertising && <>Meta Pixel measures advertising with your separate permission. </>}{!hasAnalytics && !hasAdvertising && "No optional tracking tools are currently configured."}</p>
    <div className="analytics-consent-options">
      {hasAnalytics && <label><input type="checkbox" checked={analytics} onChange={event => setAnalytics(event.target.checked)} /><span><strong>Analytics</strong><small>{providers.ga4MeasurementId && "Shopping events. "}{providers.clarityProjectId && "Masked storefront recordings. Account and checkout recordings are excluded."}</small></span></label>}
      {hasAdvertising && <label><input type="checkbox" checked={advertising} onChange={event => setAdvertising(event.target.checked)} /><span><strong>Advertising</strong><small>Meta Pixel measures product views, cart activity and purchases for advertising.</small></span></label>}
    </div>
    <p className="analytics-consent-note">Change this anytime through Cookie preferences in the footer. Turning off an active tool reloads this page.</p>
    {(hasAnalytics || hasAdvertising) && <button className="analytics-consent-save" type="button" onClick={() => save({ analytics, advertising })}>Save choices</button>}
    </div>
    {error && <p role="alert">{error}</p>}
    <div className="analytics-consent-actions"><button type="button" onClick={() => save({ analytics: false, advertising: false })}>Essential only</button>{(hasAnalytics || hasAdvertising) && <button type="button" onClick={() => save({ analytics: true, advertising: true })}>Accept all</button>}</div>
    <div className="analytics-consent-links"><button type="button" aria-expanded={settingsOpen} aria-controls={settingsId} onClick={() => setSettingsOpen(current => !current)}>{settingsOpen ? "Hide settings" : "Manage choices"}</button><a href="/privacy">Privacy policy</a></div>
  </aside>;
}
