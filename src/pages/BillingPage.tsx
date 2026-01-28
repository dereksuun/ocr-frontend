import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchBillingOverview } from "../lib/api";

type BillingRecord = Record<string, unknown>;

const getString = (value: unknown) => (typeof value === "string" ? value : "");

const getNumber = (value: unknown) => {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return 0;
};

const getNested = (record: BillingRecord, keys: string[]): BillingRecord => {
  for (const key of keys) {
    const value = record[key];
    if (value && typeof value === "object") {
      return value as BillingRecord;
    }
  }
  return {};
};

export default function BillingPage() {
  const [overview, setOverview] = useState<BillingRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchBillingOverview();
      setOverview(response);
    } catch {
      setError("Falha ao carregar billing.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const plan = useMemo(() => {
    const record = overview || {};
    const planRecord = getNested(record, ["plan", "current_plan", "subscription"]);
    const planName =
      getString(record.plan_name) ||
      getString(planRecord.name) ||
      getString(planRecord.title) ||
      "Plano básico";
    const status =
      getString(record.plan_status) ||
      getString(planRecord.status) ||
      getString(planRecord.state) ||
      "Ativo";
    const renewsAt =
      getString(record.renews_at) ||
      getString(planRecord.renews_at) ||
      getString(planRecord.renewal_date);
    return { planName, status, renewsAt };
  }, [overview]);

  const usage = useMemo(() => {
    const record = overview || {};
    const usageRecord = getNested(record, ["usage", "period_usage", "current_usage"]);
    return {
      documents: getNumber(usageRecord.documents ?? record.documents_used),
      tokens: getNumber(usageRecord.tokens ?? record.tokens_used),
      requests: getNumber(usageRecord.ai_requests ?? record.ai_requests_used),
    };
  }, [overview]);

  const limits = useMemo(() => {
    const record = overview || {};
    const limitsRecord = getNested(record, ["limits", "plan_limits"]);
    return {
      documents: getNumber(limitsRecord.documents ?? record.documents_limit),
      tokens: getNumber(limitsRecord.tokens ?? record.tokens_limit),
      requests: getNumber(limitsRecord.ai_requests ?? record.ai_requests_limit),
    };
  }, [overview]);

  return (
    <div className="card">
      <div className="page-header">
        <div>
          <h1>Billing</h1>
          <p className="help-text">Acompanhe consumo e limites do seu plano.</p>
        </div>
        <Link className="btn btn-ghost" to="/documents">
          Voltar
        </Link>
      </div>
      {loading ? <p className="help-text">Carregando overview...</p> : null}
      {error ? <p className="error-hint">{error}</p> : null}
      <p className="notice">Em breve: área de billing em evolução.</p>
      <div className="settings-grid">
        <div className="info-panel">
          <h3>Plano atual</h3>
          <div className="info-list">
            <div className="info-row">
              <span className="info-label">Plano</span>
              <span className="info-value">{plan.planName}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Status</span>
              <span className="info-value">{plan.status}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Renovação</span>
              <span className="info-value">{plan.renewsAt || "-"}</span>
            </div>
          </div>
        </div>
        <div className="info-panel">
          <h3>Consumo no período</h3>
          <div className="info-list">
            <div className="info-row">
              <span className="info-label">Documentos</span>
              <span className="info-value">{usage.documents}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Tokens</span>
              <span className="info-value">{usage.tokens}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Requisições IA</span>
              <span className="info-value">{usage.requests}</span>
            </div>
          </div>
        </div>
        <div className="info-panel">
          <h3>Uso por dia</h3>
          <p className="help-text">Em breve.</p>
        </div>
        <div className="info-panel">
          <h3>Limites</h3>
          <div className="info-list">
            <div className="info-row">
              <span className="info-label">Documentos</span>
              <span className="info-value">{limits.documents}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Tokens</span>
              <span className="info-value">{limits.tokens}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Requisições IA</span>
              <span className="info-value">{limits.requests}</span>
            </div>
          </div>
        </div>
        <div className="info-panel">
          <h3>Historico</h3>
          <p className="help-text">Em breve.</p>
        </div>
        <div className="info-panel">
          <h3>Pagamentos</h3>
          <p className="help-text">Em breve.</p>
        </div>
        <div className="info-panel">
          <h3>Ações</h3>
          <div className="filters-actions">
            <button className="btn btn-secondary" type="button" disabled>
              Gerenciar assinatura
            </button>
            <button className="btn btn-ghost" type="button" disabled>
              Adicionar método de pagamento
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
