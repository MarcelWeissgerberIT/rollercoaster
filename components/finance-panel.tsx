"use client";

import { useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Banknote, Landmark, Wallet } from "lucide-react";
import type { Park } from "../game/simulation";
import {
  LOAN_DAILY_RATE,
  LOAN_LIMIT,
  LOAN_STEP,
  loanDailyCost,
  type LoanState,
} from "../game/loans";
import "./finance-panel.css";

const money = (n: number) =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: n % 1 ? 2 : 0,
  }).format(n);
type LoanAction = (amount: number) => string | null | void;

export function FinancePanel({
  park,
  onBorrow,
  onRepay,
}: {
  park: Park;
  onBorrow: LoanAction;
  onRepay: LoanAction;
}) {
  const [feedback, setFeedback] = useState<{ text: string; error: boolean } | null>(null);
  const loan = (park as Park & { loan?: LoanState }).loan,
    debt = loan?.principal ?? 0,
    remaining = Math.max(0, LOAN_LIMIT - debt),
    dailyInterest = loanDailyCost({ loan }),
    repayAmounts = [...new Set([Math.min(LOAN_STEP, debt), Math.min(5000, debt), debt])].filter(
      (n) => n > 0,
    );
  const act = (handler: LoanAction, amount: number, label: string) => {
    const error = handler(amount);
    setFeedback({
      text: typeof error === "string" ? error : `${money(amount)} ${label}.`,
      error: typeof error === "string",
    });
  };
  return (
    <section className="fp-panel" data-testid="finance-panel" aria-label="Parkfinanzen und Kredit">
      <header className="fp-header">
        <span>
          <Landmark aria-hidden="true" /> Parkfinanzen
        </span>
        <h3>Spielraum für deinen Park</h3>
        <p>Ein optionaler Baukredit hilft beim Start und bei der nächsten Erweiterung.</p>
      </header>
      <div className="fp-balances">
        <article>
          <Wallet aria-hidden="true" />
          <span>Bargeld</span>
          <strong className={park.cash < 0 ? "fp-negative" : ""}>{money(park.cash)}</strong>
        </article>
        <article>
          <Landmark aria-hidden="true" />
          <span>Offener Kredit</span>
          <strong>{money(debt)}</strong>
        </article>
        <article>
          <Banknote aria-hidden="true" />
          <span>Zinsen / Spieltag</span>
          <strong>{money(dailyInterest)}</strong>
        </article>
      </div>
      <div className="fp-credit-meter">
        <div>
          <span>Verfügbarer Kreditrahmen</span>
          <strong>{money(remaining)}</strong>
        </div>
        <progress value={debt} max={LOAN_LIMIT} aria-label="Ausgeschöpfter Kreditrahmen" />
        <small>
          {money(debt)} von maximal {money(LOAN_LIMIT)} offen
        </small>
      </div>
      <section className="fp-actions" aria-label="Kredit aufnehmen">
        <h4>
          <ArrowDownToLine aria-hidden="true" /> Kredit auszahlen
        </h4>
        <p>Der gewählte Betrag wird deiner Kasse sofort gutgeschrieben.</p>
        <div className="fp-button-row">
          {[LOAN_STEP, 5000, 10000].map((amount) => (
            <button
              type="button"
              key={amount}
              disabled={amount > remaining}
              onClick={() => act(onBorrow, amount, "Kredit ausgezahlt")}
            >
              + {money(amount)}
            </button>
          ))}
        </div>
      </section>
      <section className="fp-actions fp-repay" aria-label="Kredit zurückzahlen">
        <h4>
          <ArrowUpFromLine aria-hidden="true" /> Freiwillig zurückzahlen
        </h4>
        <p>
          {debt > 0
            ? "Tilge aus deinem verfügbaren Bargeld. Die Restschuld und die nächsten Zinsen sinken sofort."
            : "Es ist kein Kredit offen. Dein voller Kreditrahmen ist verfügbar."}
        </p>
        {debt > 0 && (
          <div className="fp-button-row">
            {repayAmounts.map((amount) => (
              <button
                type="button"
                key={amount}
                disabled={park.cash < amount}
                onClick={() => act(onRepay, amount, "zurückgezahlt")}
              >
                {amount === debt ? `Alles · ${money(amount)}` : money(amount)}
              </button>
            ))}
          </div>
        )}
        {debt > 0 && park.cash < Math.min(LOAN_STEP, debt) && (
          <small className="fp-cash-note">
            Für den kleinsten Rückzahlungsbetrag fehlt noch Bargeld.
          </small>
        )}
      </section>
      <aside className="fp-terms">
        <strong>{(LOAN_DAILY_RATE * 100).toLocaleString("de-DE")} % Zins je Spieltag</strong>
        <p>
          Zinsen werden am Tagesende auf die dann offene Summe berechnet. Ein Spieltag dauert 90
          Sekunden Simulationszeit. Der Zins bleibt in jeder Schwierigkeit gleich.
        </p>
        <p>
          Keine automatische Tilgung. Kreditaufnahme und Rückzahlung verändern Bargeld und
          Restschuld. Nur Zinsen zählen zu den laufenden Ausgaben.
        </p>
        {loan && loan.interestPaid > 0 && (
          <small>Bisher berechnete Kreditzinsen: {money(loan.interestPaid)}</small>
        )}
      </aside>
      <section className="fp-day" aria-label="Tatsächliche Tagesfinanzen">
        <h4>Deine tatsächlichen Zahlen</h4>
        <dl>
          <div>
            <dt>Einnahmen heute</dt>
            <dd>{money(park.dayIncome)}</dd>
          </div>
          <div>
            <dt>Ausgaben heute</dt>
            <dd>{money(park.dayExpenses)}</dd>
          </div>
          <div>
            <dt>Saldo letzter abgeschlossener Spieltag</dt>
            <dd>{park.time >= 90 ? money(park.lastProfit) : "Noch kein Tagesabschluss"}</dd>
          </div>
        </dl>
        <small>
          Der Tagessaldo enthält die tatsächlich gebuchten Kosten einschließlich Kreditzinsen und
          Bauausgaben.
        </small>
      </section>
      {feedback && (
        <p className={`fp-feedback${feedback.error ? " fp-feedback--error" : ""}`} role="status">
          {feedback.text}
        </p>
      )}
    </section>
  );
}
