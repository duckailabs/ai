"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { LintResult, ParsedTemplate } from "@fatduckai/ai";
import { Linter, Parser } from "@fatduckai/ai";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";

const defaultTemplate = `{{#system}}
You are a helpful assistant who excels at technical writing.
{{/system}}

{{#user}}
Write a technical document about {{topic}}.
{{/user}}

{{#assistant}}
{{gen 'Write a technical document about the given topic' | { tone: 'professional' }}}
{{/assistant}}`;

const linter = new Linter();

export default function TemplatePlayground() {
  const [template, setTemplate] = useState(defaultTemplate);
  const [parseResult, setParseResult] = useState<ParsedTemplate | null>(null);
  const [lintResults, setLintResults] = useState<LintResult[]>([]);
  const [error, setError] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const analyzeTemplate = async () => {
    setIsAnalyzing(true);
    try {
      console.time("parse");
      const result = Parser.parse(template);
      console.timeEnd("parse");
      setParseResult(result);
      setError("");

      console.time("lint");
      const lintResults = await linter.lint(result);
      console.timeEnd("lint");
      setLintResults(lintResults);
    } catch (err) {
      console.error("Analysis error:", err);
      setError(err instanceof Error ? err.message : String(err));
      setParseResult(null);
      setLintResults([]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const formatSeverityClass = (severity: LintResult["severity"]) => {
    switch (severity) {
      case "error":
        return "destructive";
      default:
        return "default";
    }
  };

  return (
    <div className="container mx-auto py-10 space-y-8">
      <div className="flex flex-col space-y-2">
        <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl">
          Template Playground
        </h1>
        <p className="text-muted-foreground">
          Test and validate your templates with real-time parsing and linting
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Template Input</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                className="font-mono min-h-[400px] resize-none"
                placeholder="Enter your template..."
                spellCheck={false}
              />
            </CardContent>
          </Card>
          <Button onClick={analyzeTemplate} disabled={isAnalyzing}>
            {isAnalyzing ? "Analyzing..." : "Analyze Template"}
          </Button>
        </div>

        <div className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Parsed Result</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-muted p-4 rounded-md overflow-auto max-h-[200px] text-sm">
                {parseResult
                  ? JSON.stringify(
                      {
                        blocks: parseResult.blocks,
                        variables: Array.from(parseResult.variables),
                      },
                      null,
                      2
                    )
                  : "Click 'Analyze Template' to see results"}
              </pre>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                Lint Results
                {lintResults.length > 0 && (
                  <span className="ml-2 text-sm text-muted-foreground">
                    ({lintResults.length}{" "}
                    {lintResults.length === 1 ? "issue" : "issues"})
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {lintResults.length > 0 ? (
                  lintResults.map((result, index) => (
                    <Alert
                      key={`${result.line}-${result.column}-${index}`}
                      variant={formatSeverityClass(result.severity)}
                    >
                      <AlertDescription>
                        <div className="flex items-start gap-2">
                          <span className="font-mono text-sm whitespace-nowrap">
                            Line {result.line}:{result.column}
                          </span>
                          <span>{result.message}</span>
                        </div>
                      </AlertDescription>
                    </Alert>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {parseResult
                      ? "No lint issues found"
                      : "Click 'Analyze Template' to see results"}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
