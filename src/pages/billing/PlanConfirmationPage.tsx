import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { billingApi } from "../../api/client";
import { PlanConfirmation } from "../../components/PlanConfirmation";
import { useAuth } from "../../context/AuthContext";
import { useI18n } from "../../i18n/I18nContext";
import type { ProCheckoutPlan } from "../../lib/commercialDisclosure";

/**
 * PRO 申込み：Stripe Checkout / Payment Link の直前確認（特商法改正対応）。
 */
export function PlanConfirmationPage() {
  const navigate = useNavigate();
  const { me, ready } = useAuth();
  const { t } = useI18n();
  const [plan, setPlan] = useState<ProCheckoutPlan>("monthly");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const startCheckout = useCallback(async () => {
    if (!me) {
      navigate("/login", { replace: true, state: { from: "/billing/confirm" } });
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { url } = await billingApi.createCheckoutSession({
        plan,
        userId: String(me.user.id),
      });
      window.location.href = url;
    } catch (e) {
      setError(
        e instanceof Error ? e.message : t("billing.confirm.checkoutFail")
      );
      setBusy(false);
    }
  }, [navigate, me, plan, t]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f172a",
        color: "#e2e8f0",
        padding: "28px 20px 48px",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {!ready ? (
        <p style={{ color: "#94a3b8", fontSize: 14 }}>
          {t("billing.confirm.loading")}
        </p>
      ) : (
        <PlanConfirmation
          plan={plan}
          onPlanChange={(next) => {
            setPlan(next);
            setConfirmed(false);
          }}
          confirmed={confirmed}
          onConfirmedChange={setConfirmed}
          busy={busy}
          error={!me ? t("billing.confirm.needLogin") : error}
          onConfirm={() => {
            if (!me) {
              navigate("/login", {
                replace: true,
                state: { from: "/billing/confirm" },
              });
              return;
            }
            void startCheckout();
          }}
          onCancel={() => navigate(-1)}
        />
      )}
    </div>
  );
}
