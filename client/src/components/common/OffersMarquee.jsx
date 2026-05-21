import React, { useMemo } from "react";
import { Flame, CalendarDays, Timer } from "lucide-react";

function isOfferActive(statusValue) {
  if (statusValue === true || statusValue === 1) return true;
  if (typeof statusValue === "string") {
    const normalized = statusValue.trim().toLowerCase();
    return ["active", "enabled", "yes", "y", "true", "1"].includes(normalized);
  }
  return false;
}

export function formatOfferLine(offer) {
  const offerQty = Number(offer?.offer_quantity);
  const freeQty = Number(offer?.free_item_quantity);
  const itemName = offer?.item_name || "Item";
  const freeItemName = offer?.free_item || "Free item";

  if (!Number.isNaN(offerQty) && offerQty > 0 && freeItemName) {
    const freePart = !Number.isNaN(freeQty) && freeQty > 0 ? `Get ${freeQty}` : "Get";
    return `Buy ${offerQty} ${itemName} • ${freePart} ${freeItemName}`;
  }

  return offer?.message || `Offer on ${itemName}`;
}

function clampSubtitle(offer) {
  const raw = offer?.message ? String(offer.message) : "";
  const normalized = raw.replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  if (normalized.length <= 70) return normalized;
  return `${normalized.slice(0, 67)}...`;
}

function getChip(offer) {
  const active = isOfferActive(offer?.status);
  if (active) return { label: "HOT", Icon: Flame };

  // Keep it simple and premium: if the backend flags a date, call it TODAY; otherwise LIMITED.
  const hasDate = Boolean(offer?.offer_date);
  return hasDate ? { label: "TODAY", Icon: CalendarDays } : { label: "LIMITED", Icon: Timer };
}

export const mockOffers = [
  {
    offer_id: "mock-1",
    item_name: "Chicken Biryani",
    free_item: "Coke",
    offer_quantity: 2,
    free_item_quantity: 1,
    message: "Weekend special — limited stock.",
    status: "active",
  },
  {
    offer_id: "mock-2",
    item_name: "Paneer Tikka",
    free_item: "Mint Chaas",
    offer_quantity: 1,
    free_item_quantity: 1,
    message: "Chef’s pick for today.",
    status: "1",
  },
  {
    offer_id: "mock-3",
    item_name: "Mocktail",
    free_item: "Fries",
    offer_quantity: 3,
    free_item_quantity: 1,
    message: "Perfect pairing deal.",
    status: "enabled",
  },
];

function OfferCard({ offer }) {
  const headline = formatOfferLine(offer);
  const subtitle = clampSubtitle(offer);
  const chip = getChip(offer);
  const ChipIcon = chip.Icon;
  const active = isOfferActive(offer?.status);

  return (
    <article
      className="group relative w-[320px] sm:w-[360px] md:w-[420px] shrink-0 overflow-hidden rounded-[26px] border border-white/20 bg-white/5 shadow-[0_8px_18px_rgba(0,0,0,0.08)] backdrop-blur-lg transition-shadow duration-300 hover:shadow-[0_10px_22px_rgba(0,0,0,0.10)]"
      role="listitem"
      aria-label={headline}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-afmc-maroon/95 via-[#7a0b2e]/85 to-[#2a0b14]/95" />

      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.65]"
      >
        <svg viewBox="0 0 640 260" className="h-full w-full">
          <defs>
            <linearGradient id="afmc-offer-wave" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#caa84a" stopOpacity="0.10" />
              <stop offset="55%" stopColor="#caa84a" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0.06" />
            </linearGradient>
            <radialGradient id="afmc-offer-radial" cx="35%" cy="25%" r="70%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="afmc-offer-streak" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#caa84a" stopOpacity="0" />
              <stop offset="50%" stopColor="#caa84a" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#caa84a" stopOpacity="0" />
            </linearGradient>
          </defs>

          <path
            d="M0,170 C120,120 210,235 330,180 C450,125 520,55 640,110 L640,260 L0,260 Z"
            fill="url(#afmc-offer-wave)"
          />
          <circle cx="135" cy="78" r="44" fill="url(#afmc-offer-radial)" opacity="0.9" />
          <circle cx="520" cy="58" r="58" fill="url(#afmc-offer-radial)" opacity="0.65" />
          <path d="M-60 56 L220 20" stroke="url(#afmc-offer-streak)" strokeWidth="14" opacity="0.55" />
        </svg>
      </div>

      <div
        aria-hidden="true"
        className={`absolute -inset-24 rounded-full blur-3xl transition-opacity duration-700 ${
          active ? "opacity-55" : "opacity-35"
        }`}
        style={{
          background:
            "radial-gradient(closest-side, rgba(202,168,74,0.22), rgba(202,168,74,0.0) 70%)",
        }}
      />

      <div className="relative flex h-full flex-col gap-3 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-extrabold tracking-[0.14em] text-white/95 ring-1 ring-white/15">
                <ChipIcon className="h-3.5 w-3.5 text-afmc-gold" />
                {chip.label}
              </span>
              <span className="h-1.5 w-1.5 rounded-full bg-afmc-gold/70" />
              <span className="text-[11px] font-semibold text-white/70">Offers</span>
            </div>
          </div>

          <div className="h-10 w-10 rounded-2xl bg-white/10 ring-1 ring-white/10" aria-hidden="true" />
        </div>

        <div className="space-y-1.5">
          <h3 className="line-clamp-2 text-[15px] sm:text-[16px] font-extrabold leading-snug tracking-tight text-white">
            {headline}
          </h3>
          {subtitle ? (
            <p className="line-clamp-1 text-xs font-medium text-white/75">{subtitle}</p>
          ) : null}
        </div>

        <div className="mt-1 h-[1px] w-full bg-gradient-to-r from-white/0 via-white/20 to-white/0" />

        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-white/70">Premium deals</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-afmc-gold/10 px-2.5 py-1 text-[11px] font-bold text-afmc-gold ring-1 ring-afmc-gold/25">
            Save more
          </span>
        </div>
      </div>
    </article>
  );
}

function SkeletonRow() {
  return (
    <div className="relative overflow-hidden rounded-[26px] border border-gray-200 bg-white shadow-sm">
      <div className="h-[132px] w-[320px] sm:w-[360px] md:w-[420px] animate-pulse bg-gradient-to-br from-gray-100 to-gray-50" />
    </div>
  );
}

export default function OffersMarquee({
  offers,
  loading,
  title = "Offers for you",
  subtitle = "Premium deals curated for today.",
  useMockWhenEmpty = true,
  speedSeconds = 34,
}) {
  const cleaned = useMemo(() => {
    const raw = Array.isArray(offers) ? offers : [];
    const list = raw
      .filter(Boolean)
      .map((o, idx) => ({
        ...o,
        __key: String(o?.offer_id ?? o?.id ?? `${o?.item_name ?? "offer"}-${idx}`),
      }));

    if (list.length > 0) return list.slice(0, 12);
    if (loading || !useMockWhenEmpty) return [];
    return mockOffers.map((o) => ({ ...o, __key: String(o.offer_id) }));
  }, [offers, loading, useMockWhenEmpty]);

  const shouldRender = loading || cleaned.length > 0;
  const animDuration = `${Math.max(18, Number(speedSeconds) || 34)}s`;
  const twoOfferSpeed = cleaned.length <= 2;
  const resolvedDuration = twoOfferSpeed ? `${Math.max(26, Number(speedSeconds) || 34)}s` : animDuration;

  if (!shouldRender) return null;

  return (
    <section className="mb-8">
      <style>
        {`
          @keyframes afmc-marquee {
            0% { transform: translate3d(0,0,0); }
            100% { transform: translate3d(-50%,0,0); }
          }
          @keyframes afmc-shimmer {
            0% { transform: translateX(-30%); opacity: 0; }
            40% { opacity: 0.45; }
            100% { transform: translateX(130%); opacity: 0; }
          }
          @media (prefers-reduced-motion: reduce) {
            .afmc-marquee-track { animation: none !important; transform: none !important; }
            .afmc-shimmer { display: none !important; }
          }
        `}
      </style>

      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-base font-extrabold tracking-tight text-gray-900">{title}</h2>
          <p className="mt-1 text-xs text-gray-600">{subtitle}</p>
        </div>
      </div>

      <div className="relative">
        <div className="relative overflow-hidden rounded-[30px] border border-gray-200 bg-white shadow-sm">
          <div
            className="afmc-shimmer pointer-events-none absolute inset-y-0 left-0 w-1/3 skew-x-[-18deg] bg-gradient-to-r from-transparent via-[#caa84a]/20 to-transparent"
            style={{ animation: "afmc-shimmer 6.5s ease-in-out infinite" }}
            aria-hidden="true"
          />

          <div className="group relative px-2 py-4 sm:px-3 sm:py-5">
            {loading ? (
              <div className="flex gap-4">
                {Array.from({ length: 3 }).map((_, idx) => (
                  <SkeletonRow key={idx} />
                ))}
              </div>
            ) : (
              <div
                className="afmc-marquee-track flex w-max gap-3 sm:gap-4 group-hover:[animation-play-state:paused]"
                style={{
                  animation: `afmc-marquee ${resolvedDuration} linear infinite`,
                  animationPlayState: "running",
                }}
              >
                <div className="flex gap-3 sm:gap-4 pr-3 sm:pr-4">
                  {cleaned.map((offer) => (
                    <OfferCard key={offer.__key} offer={offer} />
                  ))}
                </div>
                <div className="flex gap-3 sm:gap-4 pr-3 sm:pr-4" aria-hidden="true">
                  {cleaned.map((offer) => (
                    <OfferCard key={`${offer.__key}-dup`} offer={offer} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
