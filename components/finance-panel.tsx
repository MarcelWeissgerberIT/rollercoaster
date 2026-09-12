"use client";

import { useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Banknote, Landmark, Wallet } from "lucide-react";
import type { Park } from "../game/simulation";
import { BILLING_PERIOD_SECONDS } from "../game/calendar";
import { canAfford, hasUnlimitedBudget } from "../game/budget";
import {
  LOAN_DAILY_RATE,
  LOAN_LIMIT,
  LOAN_STEP,
  loanDailyCost,
  type LoanState,
} from "../game/loans";
import "./finance-panel.css";
import { FINANCE_CATEGORIES, periodCategories, type FinanceCategory } from "../game/finance";

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
  const unlimited = hasUnlimitedBudget(park);
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
        <h3>{unlimited ? "Freies Spiel ohne Geldlimit" : "Spielraum für deinen Park"}</h3>
        <p>
          {unlimited
            ? "Dein Budget ist unbegrenzt. Du kannst bauen und deinen Park betreiben, ohne einen Kredit aufzunehmen."
            : "Ein optionaler Baukredit hilft beim Start und bei der nächsten Erweiterung."}
        </p>
      </header>
      <div className={`fp-balances${unlimited && !debt ? " fp-balances--unlimited" : ""}`}>
        <article>
          <Wallet aria-hidden="true" />
          <span>{unlimited ? "Unbegrenztes Budget" : "Bargeld"}</span>
          <strong
            className={!unlimited && park.cash < 0 ? "fp-negative" : ""}
            data-testid="finance-budget"
            aria-label={unlimited ? "Unbegrenzt" : undefined}
          >
            {unlimited ? "∞" : money(park.cash)}
          </strong>
        </article>
        {(!unlimited || debt > 0) && (
          <article>
            <Landmark aria-hidden="true" />
            <span>Offener Kredit</span>
            <strong>{money(debt)}</strong>
          </article>
        )}
        {(!unlimited || debt > 0) && (
          <article>
            <Banknote aria-hidden="true" />
            <span>Zinsen / 90 s</span>
            <strong>{money(dailyInterest)}</strong>
          </article>
        )}
      </div>
      {!unlimited && (
        <>
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
        </>
      )}
      {(!unlimited || debt > 0) && (
        <>
          <section className="fp-actions fp-repay" aria-label="Kredit zurückzahlen">
            <h4>
              <ArrowUpFromLine aria-hidden="true" /> Freiwillig zurückzahlen
            </h4>
            <p>
              {debt > 0
                ? unlimited
                  ? "Du kannst den bestehenden Kredit aus dem unbegrenzten Budget zurückzahlen. Die Restschuld und die nächsten Zinsen sinken sofort."
                  : "Tilge aus deinem verfügbaren Bargeld. Die Restschuld und die nächsten Zinsen sinken sofort."
                : "Es ist kein Kredit offen. Dein voller Kreditrahmen ist verfügbar."}
            </p>
            {debt > 0 && (
              <div className="fp-button-row">
                {repayAmounts.map((amount) => (
                  <button
                    type="button"
                    key={amount}
                    disabled={!canAfford(park, amount)}
                    onClick={() => act(onRepay, amount, "zurückgezahlt")}
                  >
                    {amount === debt ? `Alles · ${money(amount)}` : money(amount)}
                  </button>
                ))}
              </div>
            )}
            {debt > 0 && !canAfford(park, Math.min(LOAN_STEP, debt)) && (
              <small className="fp-cash-note">
                Für den kleinsten Rückzahlungsbetrag fehlt noch Bargeld.
              </small>
            )}
          </section>
          <aside className="fp-terms">
            <strong>
              {(LOAN_DAILY_RATE * 100).toLocaleString("de-DE")} % Zins je Abrechnungsperiode
            </strong>
            <p>
              Zinsen werden alle {BILLING_PERIOD_SECONDS} Sekunden Simulationszeit auf die dann
              offene Summe berechnet. Diese Abrechnungsperiode ist unabhängig vom Kalendertag. Der
              Zins bleibt in jeder Schwierigkeit gleich.
            </p>
            <p>
              {unlimited
                ? "Keine automatische Tilgung. Rückzahlungen senken die Restschuld. Nur Zinsen zählen zu den laufenden Ausgaben."
                : "Keine automatische Tilgung. Kreditaufnahme und Rückzahlung verändern Bargeld und Restschuld. Nur Zinsen zählen zu den laufenden Ausgaben."}
            </p>
            {loan && loan.interestPaid > 0 && (
              <small>Bisher berechnete Kreditzinsen: {money(loan.interestPaid)}</small>
            )}
          </aside>
        </>
      )}
      <section className="fp-day" aria-label="Finanzen der Abrechnungsperiode">
        <h4>Deine tatsächlichen Zahlen</h4>
        <dl>
          <div>
            <dt>Einnahmen dieser Periode</dt>
            <dd>{money(park.dayIncome)}</dd>
          </div>
          <div>
            <dt>Ausgaben dieser Periode</dt>
            <dd>{money(park.dayExpenses)}</dd>
          </div>
          <div>
            <dt>Saldo der letzten Abrechnungsperiode</dt>
            <dd>
              {park.time >= BILLING_PERIOD_SECONDS
                ? money(park.lastProfit)
                : "Noch keine Abrechnung"}
            </dd>
          </div>
        </dl>
        <small>
          {unlimited
            ? "Die gebuchten Einnahmen und Kosten laufen zur Übersicht weiter. Dein unbegrenztes Budget schränken sie nicht ein."
            : "Der Periodensaldo enthält die tatsächlich gebuchten Kosten einschließlich Kreditzinsen und Bauausgaben."}
        </small>
      </section>
      <FinanceHistory park={park} />
      {feedback && (
        <p className={`fp-feedback${feedback.error ? " fp-feedback--error" : ""}`} role="status">
          {feedback.text}
        </p>
      )}
    </section>
  );
}

function FinanceHistory({ park }: { park: Park }) {
  const [range, setRange] = useState(16);
  const history = park.financeLedger?.history ?? [],
    periods = history.slice(-range),
    current = periodCategories(park);
  const max = Math.max(1, ...periods.flatMap((p) => [p.income, p.expenses, Math.abs(p.profit)])),
    width = 300,
    height = 130,
    baseline = 94;
  const point = (value: number, i: number) =>
    `${16 + i * Math.max(1, (width - 32) / Math.max(1, periods.length - 1))},${baseline - (value / max) * 74}`;
  const categories = Object.entries(FINANCE_CATEGORIES) as [
    FinanceCategory,
    (typeof FINANCE_CATEGORIES)[FinanceCategory],
  ][];
  return (
    <section className="fp-history" aria-label="Finanzverlauf und Kategorien">
      <h4>Finanzverlauf</h4>
      <p>
        Gespeicherte Abrechnungen alle 90 Spielsekunden. Grün: Einnahmen · Rot: Ausgaben · Dunkel:
        Saldo.
      </p>
      <div className="fp-history-ranges">
        {[8, 16, 40, 160].map((n) => (
          <button type="button" key={n} aria-pressed={range === n} onClick={() => setRange(n)}>
            {n} Perioden
          </button>
        ))}
      </div>
      {periods.length ? (
        <>
          <svg
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label={`Einnahmen, Ausgaben und Saldo der letzten ${periods.length} Abrechnungen`}
          >
            <line x1="12" y1={baseline} x2="288" y2={baseline} stroke="#c8d2c4" />
            {(["income", "expenses", "profit"] as const).map((key, i) => (
              <polyline
                key={key}
                points={periods.map((p, n) => point(p[key], n)).join(" ")}
                fill="none"
                stroke={["#638d73", "#c18476", "#334d45"][i]}
                strokeWidth={i === 2 ? 2.5 : 1.6}
              />
            ))}
            <text x="12" y="12" fill="#637663" fontSize="9">
              {money(max)}
            </text>
            <text x="12" y="125" fill="#637663" fontSize="9">
              J{periods[0].year} / Tag {periods[0].day}
            </text>
            <text x="225" y="125" fill="#637663" fontSize="9">
              J{periods.at(-1)!.year} / Tag {periods.at(-1)!.day}
            </text>
          </svg>
          <details>
            <summary>Abrechnungen als Tabelle</summary>
            <div className="fp-history-table">
              <table>
                <thead>
                  <tr>
                    <th>Jahr / Tag</th>
                    <th>Einnahmen</th>
                    <th>Ausgaben</th>
                    <th>Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {[...periods].reverse().map((p) => (
                    <tr key={p.time}>
                      <th>
                        {p.year} / {p.day}
                      </th>
                      <td>{money(p.income)}</td>
                      <td>{money(p.expenses)}</td>
                      <td>{money(p.profit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      ) : (
        <p className="fp-history-empty">
          Die erste vollständige Abrechnung erscheint nach 90 Spielsekunden. Alte Zeiträume werden
          nicht nachträglich erfunden.
        </p>
      )}
      <h4>Wohin fließt das Geld?</h4>
      <p>
        Aktuelle Periode. Bauausgaben und weitere Buchungen bleiben separat sichtbar; Kreditaufnahme
        ist kein Gewinn.
      </p>
      {(["income", "expense"] as const).map((flow) => (
        <div className="fp-category-group" key={flow}>
          <h5>{flow === "income" ? "Einnahmen" : "Ausgaben"}</h5>
          {categories
            .filter(([, c]) => c.flow === flow)
            .map(([key, c]) => (
              <div className="fp-category" key={key}>
                <div>
                  <span>{c.label}</span>
                  <strong>{money(current[key] ?? 0)}</strong>
                </div>
                <div className="fp-category-bar">
                  <i
                    style={{
                      width: `${Math.min(100, ((current[key] ?? 0) / Math.max(1, flow === "income" ? park.dayIncome : park.dayExpenses)) * 100)}%`,
                      background: c.color,
                    }}
                  />
                </div>
              </div>
            ))}
        </div>
      ))}
    </section>
  );
}
