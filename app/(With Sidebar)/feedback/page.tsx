import { Suspense } from "react";
import { FeedbackClientContent } from "./ClientComponent";
import { Loader2 } from "lucide-react";

export default function FeedbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <FeedbackClientContent />
    </Suspense>
  );
}
