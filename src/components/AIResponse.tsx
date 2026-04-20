import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { Sparkles, Copy, Check } from "lucide-react";
import { useState } from "react";
import { cleanText } from "@/lib/sanitize";

type Props = {
  title?: string;
  content: string;
  streaming?: boolean;
};

export const AIResponse = ({ title = "AI Response", content, streaming }: Props) => {
  const [copied, setCopied] = useState(false);
  const clean = cleanText(content);

  const copy = async () => {
    await navigator.clipboard.writeText(clean);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="glass-strong rounded-2xl overflow-hidden border border-primary/20">
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-gradient-to-r from-primary/10 via-secondary/10 to-transparent">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-gradient-primary grid place-items-center shadow-glow">
            <Sparkles className="h-3.5 w-3.5 text-primary-foreground" />
          </div>
          <span className="text-sm font-semibold gradient-text">{title}</span>
          {streaming && (
            <span className="ml-1 inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-accent">
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
              streaming
            </span>
          )}
        </div>
        <button
          onClick={copy}
          className="text-xs flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground transition"
        >
          {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div className="px-5 py-4 ai-prose text-sm">
        <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
          {clean}
        </ReactMarkdown>
      </div>
    </div>
  );
};
