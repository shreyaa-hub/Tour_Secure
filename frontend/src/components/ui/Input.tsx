import { InputHTMLAttributes } from "react";
export default function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  // Full width by default, unless the caller sets its own width (e.g. "w-40")
  const width = /(^|\s)w-/.test(props.className || "") ? "" : "w-full";
  return <input {...props} className={`${width} rounded-lg border border-neutral-300 px-3 py-2 shadow-sm focus:border-black focus:ring-1 focus:ring-black ${props.className||""}`} />;
}
