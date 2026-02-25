import { getDatabase } from '../db/schema';
import { setCachedStats } from '../db/queries';

export interface GenreBreakdown {
  genre: string;
  count: number;
  percentage: number;
}

export interface DecadeDistribution {
  decade: string;
  count: number;
  percentage: number;
}

export interface LabelCount {
  label: string;
  count: number;
}

export interface FormatBreakdown {
  format: string;
  count: number;
  percentage: number;
}

export interface CollectionGrowth {
  month: string;
  count: number;
  cumulative: number;
}

export interface CollectionStats {
  totalRecords: number;
  genres: GenreBreakdown[];
  decades: DecadeDistribution[];
  topLabels: LabelCount[];
  formats: FormatBreakdown[];
  growth: CollectionGrowth[];
  oldestRecord: { title: string; artist: string; year: number } | null;
  newestRecord: { title: string; artist: string; year: number } | null;
}

export async function computeAllStats(): Promise<CollectionStats> {
  const db = await getDatabase();

  const [totalResult, genres, decades, labels, formats, growth, oldest, newest] =
    await Promise.all([
      db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM collection_items'
      ),

      db.getAllAsync<{ genre: string; count: number }>(
        `SELECT j.value as genre, COUNT(*) as count
         FROM collection_items, json_each(collection_items.genres) as j
         GROUP BY j.value ORDER BY count DESC LIMIT 10`
      ),

      db.getAllAsync<{ decade: number; count: number }>(
        `SELECT (year / 10) * 10 as decade, COUNT(*) as count
         FROM collection_items
         WHERE year IS NOT NULL AND year > 0
         GROUP BY decade ORDER BY decade`
      ),

      db.getAllAsync<{ label: string; count: number }>(
        `SELECT j.value as label, COUNT(*) as count
         FROM collection_items, json_each(collection_items.labels) as j
         GROUP BY j.value ORDER BY count DESC LIMIT 10`
      ),

      db.getAllAsync<{ format: string; count: number }>(
        `SELECT j.value as format, COUNT(*) as count
         FROM collection_items, json_each(collection_items.formats) as j
         GROUP BY j.value ORDER BY count DESC`
      ),

      db.getAllAsync<{ month: string; count: number }>(
        `SELECT strftime('%Y-%m', date_added) as month, COUNT(*) as count
         FROM collection_items GROUP BY month ORDER BY month`
      ),

      db.getFirstAsync<{ title: string; artist: string; year: number }>(
        `SELECT title, artist, year FROM collection_items
         WHERE year IS NOT NULL AND year > 0
         ORDER BY year ASC LIMIT 1`
      ),

      db.getFirstAsync<{ title: string; artist: string; year: number }>(
        `SELECT title, artist, year FROM collection_items
         WHERE year IS NOT NULL AND year > 0
         ORDER BY year DESC LIMIT 1`
      ),
    ]);

  const total = totalResult?.count ?? 0;

  const genresWithPct = genres.map((g) => ({
    ...g,
    percentage: total > 0 ? Math.round((g.count / total) * 100) : 0,
  }));

  const decadesWithPct = decades.map((d) => ({
    decade: `${d.decade}s`,
    count: d.count,
    percentage: total > 0 ? Math.round((d.count / total) * 100) : 0,
  }));

  const formatsWithPct = formats.map((f) => ({
    ...f,
    percentage: total > 0 ? Math.round((f.count / total) * 100) : 0,
  }));

  let cumulative = 0;
  const growthWithCumulative = growth.map((g) => {
    cumulative += g.count;
    return { ...g, cumulative };
  });

  const stats: CollectionStats = {
    totalRecords: total,
    genres: genresWithPct,
    decades: decadesWithPct,
    topLabels: labels,
    formats: formatsWithPct,
    growth: growthWithCumulative,
    oldestRecord: oldest,
    newestRecord: newest,
  };

  // Cache all stats
  await setCachedStats('collection_stats', stats);

  return stats;
}
