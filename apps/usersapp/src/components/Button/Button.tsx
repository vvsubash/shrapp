import type { ButtonHTMLAttributes } from "react";
import "./Button.css";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  title: string;
  variant: "primary" | "secondary";
}

export function BaseButton({ title, variant, ...rest }: ButtonProps) {
  return (
    <button className={variant} {...rest}>
      {title}
    </button>
  );
}
