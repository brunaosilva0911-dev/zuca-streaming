"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.error("[ZUCA] Erro global capturado", error);
    }
  }, [error]);

  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#05060a",
          color: "#eef1f8",
          fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif",
          padding: "24px",
        }}
      >
        <div
          style={{
            maxWidth: "34rem",
            width: "100%",
            textAlign: "center",
            borderRadius: "28px",
            border: "1px solid rgba(255,255,255,0.10)",
            background: "rgba(22,26,38,0.72)",
            backdropFilter: "blur(22px)",
            padding: "40px 28px",
          }}
        >
          <p
            style={{
              fontFamily: "ui-monospace, monospace",
              fontSize: "11px",
              letterSpacing: "0.3em",
              textTransform: "uppercase",
              color: "#ff2e63",
              margin: 0,
            }}
          >
            Falha crítica
          </p>
          <h1 style={{ margin: "14px 0 0", fontSize: "26px", fontWeight: 800 }}>
            A ZUCA precisa ser reiniciada
          </h1>
          <p
            style={{
              marginTop: "12px",
              fontSize: "14px",
              lineHeight: 1.6,
              color: "rgba(255,255,255,0.55)",
            }}
          >
            Um erro inesperado interrompeu a aplicação inteira. Nenhuma preferência foi
            perdida: tudo é salvo localmente no seu dispositivo.
          </p>
          <div
            style={{
              marginTop: "24px",
              display: "flex",
              gap: "12px",
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={reset}
              style={{
                height: "46px",
                padding: "0 22px",
                borderRadius: "16px",
                border: "none",
                background: "linear-gradient(135deg,#ff2e63,#7b5cff)",
                color: "#fff",
                fontSize: "14px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Reiniciar a ZUCA
            </button>
            <button
              type="button"
              onClick={() => window.location.assign("/")}
              style={{
                height: "46px",
                padding: "0 20px",
                borderRadius: "16px",
                border: "1px solid rgba(255,255,255,0.14)",
                background: "rgba(255,255,255,0.06)",
                color: "rgba(255,255,255,0.88)",
                fontSize: "14px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Ir para o início
            </button>
          </div>
          {error.digest ? (
            <p
              style={{
                marginTop: "20px",
                fontFamily: "ui-monospace, monospace",
                fontSize: "11px",
                color: "rgba(255,255,255,0.28)",
              }}
            >
              Referência do incidente: {error.digest}
            </p>
          ) : null}
        </div>
      </body>
    </html>
  );
}
