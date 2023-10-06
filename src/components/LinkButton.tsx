import Link, { LinkProps } from "next/link";
import { ReactNode } from "react";

export default function LinkButton({
  disabled,
  children,
  ...props
}: LinkProps & { disabled: boolean; children: ReactNode }) {
  return disabled ? (
    <a role="link" aria-disabled="true">
      {children}
    </a>
  ) : (
    <Link {...props}>{children}</Link>
  );
}
