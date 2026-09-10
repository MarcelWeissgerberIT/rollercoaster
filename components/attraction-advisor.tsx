import { useId } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  CircleAlert,
  Eye,
  Lightbulb,
  Sparkles,
} from "lucide-react";
import type { AttractionAdviceIssue, AttractionAdviceReport } from "../game/attraction-advisor";
import "./attraction-advisor.css";

export type AttractionAdvisorProps = {
  report: AttractionAdviceReport;
  onAction: (issueId: string) => void;
  onFocus?: () => void;
};

const money = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});
const number = new Intl.NumberFormat("de-DE");
const statuses = {
  blocked: { label: "Zuerst beheben", Icon: CircleAlert },
  improve: { label: "Potenzial", Icon: Lightbulb },
  healthy: { label: "Gut aufgestellt", Icon: Check },
} as const;
const severities = {
  blocker: "Verhindert Besuche",
  warning: "Besucher gewinnen",
  tip: "Weitere Möglichkeit",
} as const;

function AdviceAction({
  issue,
  onAction,
  prominent = false,
}: {
  issue: AttractionAdviceIssue;
  onAction: AttractionAdvisorProps["onAction"];
  prominent?: boolean;
}) {
  const descriptionId = useId();
  const action = issue.action;
  if (!action) return null;
  return (
    <div className="aa-action-group">
      <button
        type="button"
        className={`aa-action${prominent ? " aa-action--primary" : ""}`}
        onClick={() => onAction(issue.id)}
        disabled={!!action.disabledReason}
        aria-describedby={action.disabledReason ? descriptionId : undefined}
        data-testid={`advisor-action-${issue.id}`}
      >
        <span>{action.label}</span>
        {action.cost !== undefined && (
          <span className="aa-action-cost">
            {action.cost === 0 ? "Kostenlos" : money.format(action.cost)}
          </span>
        )}
        <ArrowRight aria-hidden="true" />
      </button>
      {action.disabledReason && (
        <p className="aa-action-reason" id={descriptionId}>
          {action.disabledReason}
        </p>
      )}
    </div>
  );
}

function AdvisorContent({ report, onAction, onFocus }: AttractionAdvisorProps) {
  const titleId = useId();
  const { Icon, label } = statuses[report.status];
  const [mainIssue, ...moreIssues] = report.issues;
  const showMainTitle = !!mainIssue && mainIssue.title !== report.headline;
  const showMainDetail = !!mainIssue && mainIssue.detail !== report.summary;
  const metrics = [
    { label: "Unterwegs", value: report.metrics.enRoute, description: "Gäste auf dem Weg hierher" },
    { label: "Warten", value: report.metrics.waiting, description: "Gäste in der Warteschlange" },
    {
      label: "Vor Ort",
      value: report.metrics.active,
      description: "Gäste, die gerade zu Besuch sind",
    },
    { label: "Besuche", value: report.metrics.served, description: "Besuche insgesamt" },
  ];

  return (
    <section
      className={`attraction-advisor aa-${report.status}`}
      aria-labelledby={titleId}
      data-testid="attraction-advisor"
      data-building-id={report.buildingId}
    >
      <header className="aa-header">
        <span className="aa-mark">
          <Sparkles aria-hidden="true" />
        </span>
        <div>
          <h3 id={titleId}>Besucher-Assistent</h3>
          <span className="aa-status">
            <Icon aria-hidden="true" />
            {label}
          </span>
        </div>
        {onFocus && (
          <button
            type="button"
            className="aa-focus"
            onClick={onFocus}
            aria-label={`${report.name} im Park ansehen`}
            title="Im Park ansehen"
          >
            <Eye aria-hidden="true" />
          </button>
        )}
      </header>

      <div className="aa-assessment">
        <h4>{report.headline}</h4>
        {report.summary && <p>{report.summary}</p>}
        {mainIssue && (
          <div className="aa-main-issue" data-testid={`advisor-issue-${mainIssue.id}`}>
            {showMainTitle && <strong>{mainIssue.title}</strong>}
            {showMainDetail && <p>{mainIssue.detail}</p>}
            <AdviceAction issue={mainIssue} onAction={onAction} prominent />
          </div>
        )}
      </div>

      <dl className="aa-metrics" aria-label={`Besucher bei ${report.name}`}>
        {metrics.map((metric) => (
          <div key={metric.label} title={metric.description}>
            <dt>{metric.label}</dt>
            <dd>{number.format(metric.value)}</dd>
          </div>
        ))}
      </dl>

      {moreIssues.length > 0 && (
        <details className="aa-more">
          <summary>
            <span>Weitere Hinweise</span>
            <span className="aa-more-count">{moreIssues.length}</span>
            <ChevronDown aria-hidden="true" />
          </summary>
          <ol className="aa-issues">
            {moreIssues.map((issue) => (
              <li
                className={`aa-issue aa-issue--${issue.severity}`}
                key={issue.id}
                data-testid={`advisor-issue-${issue.id}`}
              >
                <span className="aa-priority">
                  {issue.severity === "blocker" ? (
                    <CircleAlert aria-hidden="true" />
                  ) : (
                    <Lightbulb aria-hidden="true" />
                  )}
                  {severities[issue.severity]}
                </span>
                <h4>{issue.title}</h4>
                <p>{issue.detail}</p>
                <AdviceAction issue={issue} onAction={onAction} />
              </li>
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}

export function AttractionAdvisor(props: AttractionAdvisorProps) {
  // A newly selected attraction starts compact; live updates keep expanded advice open.
  return <AdvisorContent key={props.report.buildingId} {...props} />;
}
