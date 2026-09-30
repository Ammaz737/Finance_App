type VirtualCardFaceProps = {
  last4?: string | null;
  holderName?: string | null;
  network?: string | null;
  brand?: string | null;
  provider?: string | null;
  type?: string | null;
  status?: string | null;
  availableLabel?: string | null;
  merchantLock?: string | null;
  compact?: boolean;
};

function shortName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 2) return name;
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

function networkLabel(brand?: string | null, network?: string | null, provider?: string | null) {
  const raw = (brand || network || (provider === "stripe" ? "card" : "MOCK")).toUpperCase();
  if (raw.includes("MASTER")) return "MASTERCARD";
  if (raw.includes("VISA")) return "VISA";
  return raw;
}

function MastercardMark() {
  return (
    <span className="virtual-card-mc" aria-hidden>
      <span className="virtual-card-mc-red" />
      <span className="virtual-card-mc-orange" />
    </span>
  );
}

export function VirtualCardFace({
  last4,
  holderName,
  network,
  brand,
  provider,
  type,
  status,
  availableLabel,
  merchantLock,
  compact,
}: VirtualCardFaceProps) {
  const frozen = status === "FROZEN";
  const terminated = status === "TERMINATED";
  const statusLabel = terminated ? "Terminated" : frozen ? "Frozen" : "Virtual";
  const displayHolder = holderName ? shortName(holderName) : "—";
  const showFooterDetails = !compact;
  const showExtras = !compact && Boolean(availableLabel || merchantLock);
  const label = networkLabel(brand, network, provider);
  const isMastercard = label === "MASTERCARD";
  const isStripe = provider === "stripe" || Boolean(brand && brand.toLowerCase().includes("master")) || Boolean(brand && brand.toLowerCase().includes("visa"));
  const themeClass = terminated
    ? " is-terminated"
    : frozen
      ? " is-frozen"
      : isStripe
        ? " is-stripe"
        : "";

  return (
    <article
      className={`virtual-card${compact ? " compact" : ""}${themeClass}`}
      aria-label={`Virtual card ending ${last4 ?? "----"}`}
    >
      <div className="virtual-card-shine" aria-hidden />
      <header className="virtual-card-top">
        <span className="virtual-card-brand">{isStripe ? "Issuing" : "Finance"}</span>
        <span className="virtual-card-chip">{statusLabel}</span>
      </header>
      <div className="virtual-card-chip-row" aria-hidden>
        <span className="virtual-card-emv" />
        <span className="virtual-card-contactless">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M8.5 8.5c2.2-2.2 5.8-2.2 8 0M7 7c3.3-3.3 8.7-3.3 12 0" strokeLinecap="round" />
            <path d="M10 10c1.4-1.4 3.6-1.4 5 0M11.5 11.5c.6-.6 1.4-.6 2 0" strokeLinecap="round" />
          </svg>
        </span>
      </div>
      <p className="virtual-card-pan">•••• •••• •••• {last4 || "————"}</p>
      {showFooterDetails ? (
        <footer className="virtual-card-footer">
          <div className="virtual-card-holder">
            <span className="virtual-card-label">Cardholder</span>
            <strong title={holderName ?? undefined}>{displayHolder}</strong>
          </div>
          <div className="virtual-card-network">
            {isMastercard ? <MastercardMark /> : <span className="virtual-card-label">{label}</span>}
            <strong>{(type || "VIRTUAL").replaceAll("_", " ")}</strong>
          </div>
        </footer>
      ) : (
        <footer className="virtual-card-footer compact-footer">
          {isMastercard ? <MastercardMark /> : <span className="virtual-card-label">{label}</span>}
          <strong>{(type || "VIRTUAL").replaceAll("_", " ")}</strong>
        </footer>
      )}
      {showExtras && (
        <div className="virtual-card-extras">
          {availableLabel && <span>{availableLabel}</span>}
          {merchantLock && <span>Locked · {merchantLock}</span>}
        </div>
      )}
    </article>
  );
}
