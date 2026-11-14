import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "@/lib/cx";

/** The datasheet: a <dl> of DataRows. */
export function DataList({ className, ...rest }: HTMLAttributes<HTMLDListElement>) {
  return <dl className={cx("datalist", className)} {...rest} />;
}

export interface DataRowProps {
  label: ReactNode;
  children: ReactNode;
  className?: string;
  /** more about the same term, each its own <dd> on its own line (a skill's meter, its evidence) */
  after?: ReactNode;
  /** a key to find the row by (CAPABILITIES lights a skill's row) */
  "data-skill"?: string;
}

/** LABEL ......... VALUE — the leader dots are the label's ::after, so the markup stays a valid <dl>. */
export function DataRow({ label, children, className, after, "data-skill": skill }: DataRowProps) {
  return (
    <div className={cx("datarow", after !== undefined && "datarow--more", className)} data-skill={skill}>
      <dt>{label}</dt>
      <dd>{children}</dd>
      {after}
    </div>
  );
}
