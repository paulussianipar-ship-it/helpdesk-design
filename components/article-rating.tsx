"use client";

import { useState, useEffect } from "react";
import { Star, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface ArticleRatingProps {
  articleSlug: string;
}

const RATING_LABELS: Record<number, string> = {
  1: "Sangat Kurang",
  2: "Kurang Membantu",
  3: "Cukup Membantu",
  4: "Bermanfaat",
  5: "Sangat Bermanfaat!",
};

export function ArticleRating({ articleSlug }: ArticleRatingProps) {
  const [rating, setRating] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [hasRated, setHasRated] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem(`article_rating_${articleSlug}`);
      if (saved) {
        const val = parseInt(saved, 10);
        if (val >= 1 && val <= 5) {
          setRating(val);
          setHasRated(true);
        }
      }
    } catch {
      // ignore
    }
  }, [articleSlug]);

  const handleRate = (value: number) => {
    setRating(value);
    setHasRated(true);
    try {
      localStorage.setItem(`article_rating_${articleSlug}`, value.toString());
    } catch {
      // ignore
    }
    toast.success(`Terima kasih! Anda memberi nilai ${value} dari 5 bintang.`);
  };

  const activeStar = hovered ?? rating ?? 0;

  return (
    <div className="p-4 sm:p-5 rounded-xl border bg-card shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4 transition-all">
      <div className="text-center sm:text-left space-y-1">
        <div className="flex items-center justify-center sm:justify-start gap-2">
          <h4 className="font-bold text-foreground text-sm sm:text-base">
            {hasRated ? "Terima kasih atas penilaian Anda!" : "Bagaimana penilaian Anda terhadap artikel ini?"}
          </h4>
          {hasRated && (
            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
          )}
        </div>
        <p className="text-muted-foreground text-xs">
          {hasRated
            ? `Anda telah menilai artikel ini ${rating} dari 5 bintang (${RATING_LABELS[rating || 5]}). Klik bintang untuk mengubah nilai.`
            : "Beri bintang untuk membantu kami meningkatkan kualitas konten dan materi desain."}
        </p>
      </div>

      <div className="flex flex-col items-center sm:items-end gap-1.5 shrink-0">
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => {
            const isFilled = star <= activeStar;
            return (
              <button
                key={star}
                type="button"
                onClick={() => handleRate(star)}
                onMouseEnter={() => setHovered(star)}
                onMouseLeave={() => setHovered(null)}
                className="p-1 rounded-md transition-all duration-150 hover:scale-115 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                title={`${star} Bintang - ${RATING_LABELS[star]}`}
                aria-label={`Beri ${star} bintang`}
              >
                <Star
                  className={`h-6 w-6 sm:h-7 sm:w-7 transition-colors ${
                    isFilled
                      ? "fill-amber-400 text-amber-400 drop-shadow-xs"
                      : "text-muted-foreground/30 hover:text-amber-300"
                  }`}
                />
              </button>
            );
          })}
        </div>

        <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 h-4">
          {hovered
            ? RATING_LABELS[hovered]
            : rating
            ? `${RATING_LABELS[rating]} (${rating}/5)`
            : "Pilih 1 - 5 bintang"}
        </span>
      </div>
    </div>
  );
}
