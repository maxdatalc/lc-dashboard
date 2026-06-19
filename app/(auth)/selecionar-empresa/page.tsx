import { redirect } from "next/navigation";
import Image from "next/image";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { selecionarEmpresa, logout } from "@/app/actions/auth";

export const dynamic = "force-dynamic";

export default async function SelecionarEmpresaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const adminClient = createAdminClient();

  const { data: profile } = await adminClient
    .from("profiles")
    .select("is_system_admin")
    .eq("id", user.id)
    .maybeSingle();

  if ((profile as { is_system_admin?: boolean } | null)?.is_system_admin) {
    redirect("/admin");
  }

  const { data: tenantUsers } = await adminClient
    .from("tenant_users")
    .select("tenant_id, tenants ( id, name, slug, plan )")
    .eq("user_id", user.id);

  const tenants = (
    (tenantUsers ?? []) as unknown as Array<{
      tenant_id: string;
      tenants: { id: string; name: string; slug: string; plan: string } | null;
    }>
  )
    .map((tu) => tu.tenants)
    .filter((t): t is { id: string; name: string; slug: string; plan: string } => t !== null);

  if (tenants.length === 0) redirect("/login");

  return (
    <div className="se-root">
      <div aria-hidden className="se-bg">
        <div className="se-silk se-silk-tr" />
        <div className="se-silk se-silk-bl" />
        <div className="se-glow" />
      </div>

      <div className="se-content">
        <div className="se-logo-wrap">
          <Image
            src="/lc-logo.ico"
            alt="LC Gestor"
            width={72}
            height={72}
            className="se-logo-img"
            unoptimized
          />
        </div>

        <h1 className="se-title">Selecione a empresa</h1>
        <p className="se-subtitle">
          {tenants.length === 1
            ? "Clique para acessar seu ambiente."
            : "Escolha em qual ambiente você deseja entrar."}
        </p>

        <div className="se-list">
          {tenants.map((t) => (
            <form key={t.id} action={selecionarEmpresa}>
              <input type="hidden" name="tenantId" value={t.id} />
              <button type="submit" className="se-card">
                <div className="se-avatar">
                  {t.name.charAt(0).toUpperCase()}
                </div>
                <div className="se-card-info">
                  <p className="se-card-name">{t.name}</p>
                  <p className="se-card-slug">{t.slug}</p>
                </div>
                <span className={`se-plan ${t.plan === "premium" ? "se-plan--premium" : ""}`}>
                  {t.plan === "premium" ? "★ Premium" : "Free"}
                </span>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="se-arrow">
                  <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </form>
          ))}
        </div>

        <form action={logout} className="se-logout-wrap">
          <button type="submit" className="se-logout">
            Sair da conta
          </button>
        </form>
      </div>

      <style jsx>{`
        .se-root {
          position: relative;
          min-height: 100vh;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #08101e;
        }

        .se-bg {
          pointer-events: none;
          position: absolute;
          inset: 0;
        }

        .se-glow {
          position: absolute;
          left: 50%;
          top: 40%;
          width: 640px;
          height: 640px;
          transform: translate(-50%, -50%);
          background: radial-gradient(ellipse at center, rgba(0, 229, 255, 0.04) 0%, transparent 65%);
          border-radius: 50%;
        }

        .se-silk {
          position: absolute;
          border-radius: 38% 62% 55% 45% / 42% 38% 62% 58%;
          overflow: hidden;
        }

        .se-silk-tr {
          width: 720px;
          height: 660px;
          top: -260px;
          right: -220px;
          background: linear-gradient(
            148deg,
            rgba(170, 185, 220, 0.42) 0%,
            rgba(110, 125, 170, 0.28) 28%,
            rgba(55, 70, 115, 0.14) 55%,
            rgba(20, 35, 75, 0.05) 75%,
            transparent 90%
          );
          transform: rotate(-16deg);
        }

        .se-silk-tr::after {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          background: linear-gradient(
            205deg,
            rgba(230, 238, 255, 0.22) 0%,
            rgba(180, 195, 230, 0.10) 22%,
            transparent 48%
          );
        }

        .se-silk-bl {
          width: 620px;
          height: 560px;
          bottom: -210px;
          left: -210px;
          background: linear-gradient(
            -38deg,
            rgba(145, 160, 200, 0.36) 0%,
            rgba(85, 100, 145, 0.20) 32%,
            rgba(40, 55, 100, 0.09) 58%,
            transparent 78%
          );
          border-radius: 58% 42% 48% 52% / 52% 48% 52% 48%;
          transform: rotate(14deg);
        }

        .se-silk-bl::after {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          background: linear-gradient(
            -160deg,
            rgba(210, 220, 245, 0.18) 0%,
            rgba(160, 175, 215, 0.08) 25%,
            transparent 50%
          );
        }

        .se-content {
          position: relative;
          z-index: 10;
          width: 100%;
          max-width: 480px;
          padding: 0 20px;
        }

        .se-logo-wrap {
          display: flex;
          justify-content: center;
          margin-bottom: 20px;
        }

        .se-logo-img {
          display: block;
          filter: drop-shadow(0 6px 18px rgba(0, 229, 255, 0.18));
        }

        .se-title {
          text-align: center;
          font-size: 22px;
          font-weight: 600;
          color: #f1f5f9;
          letter-spacing: -0.02em;
          margin: 0 0 8px;
        }

        .se-subtitle {
          text-align: center;
          font-size: 13px;
          color: #475569;
          margin: 0 0 28px;
        }

        .se-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .se-card {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 14px;
          background: #111827;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 14px;
          padding: 14px 16px;
          cursor: pointer;
          text-align: left;
          transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
          color: inherit;
        }

        .se-card:hover {
          border-color: rgba(0, 229, 255, 0.3);
          background: #131f30;
          box-shadow: 0 0 0 3px rgba(0, 229, 255, 0.06);
        }

        .se-avatar {
          width: 42px;
          height: 42px;
          border-radius: 11px;
          background: linear-gradient(135deg, #0e4f6b 0%, #072030 100%);
          border: 1px solid rgba(0, 229, 255, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          font-weight: 700;
          color: #00e5ff;
          flex-shrink: 0;
        }

        .se-card-info {
          flex: 1;
          min-width: 0;
        }

        .se-card-name {
          font-size: 14px;
          font-weight: 600;
          color: #f1f5f9;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin: 0;
        }

        .se-card-slug {
          font-size: 11px;
          color: #475569;
          font-family: monospace;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin: 2px 0 0;
        }

        .se-plan {
          font-size: 11px;
          font-weight: 600;
          padding: 3px 8px;
          border-radius: 20px;
          background: rgba(255, 255, 255, 0.06);
          color: #64748b;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .se-plan--premium {
          background: rgba(217, 119, 6, 0.12);
          color: #f59e0b;
        }

        .se-arrow {
          color: #334155;
          flex-shrink: 0;
          transition: color 0.15s, transform 0.15s;
        }

        .se-card:hover .se-arrow {
          color: #00e5ff;
          transform: translateX(2px);
        }

        .se-logout-wrap {
          margin-top: 28px;
          display: flex;
          justify-content: center;
        }

        .se-logout {
          background: none;
          border: none;
          color: #334155;
          font-size: 12px;
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 6px;
          transition: color 0.12s;
        }

        .se-logout:hover {
          color: #64748b;
        }

        @media (max-width: 480px) {
          .se-silk-bl { display: none; }
          .se-silk-tr {
            width: 460px;
            height: 420px;
            top: -160px;
            right: -150px;
          }
          .se-title { font-size: 20px; }
        }
      `}</style>
    </div>
  );
}
