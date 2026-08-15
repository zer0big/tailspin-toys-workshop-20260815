/**
 * Data-access helpers for game records, including deterministic ordering and
 * reusable filtering by category and publisher.
 */

import { and, asc, eq, inArray, type SQL } from 'drizzle-orm';
import type { Database } from './db';
import { games, categories, publishers } from '../../db/schema';
import type { Game } from '../types/game';

const gameSelection = {
    id: games.id,
    title: games.title,
    description: games.description,
    starRating: games.starRating,
    categoryId: categories.id,
    categoryName: categories.name,
    publisherId: publishers.id,
    publisherName: publishers.name,
};

type GameSelectionRow = {
    id: number;
    title: string;
    description: string;
    starRating: number | null;
    categoryId: number | null;
    categoryName: string | null;
    publisherId: number | null;
    publisherName: string | null;
};

/**
 * Filter options for querying games.
 */
export interface GameFilters {
    categoryIds?: number[];
    publisherId?: number;
}

function mapGame(row: GameSelectionRow): Game {
    return {
        id: row.id,
        title: row.title,
        description: row.description,
        starRating: row.starRating,
        category:
            row.categoryId !== null && row.categoryName !== null
                ? { id: row.categoryId, name: row.categoryName }
                : null,
        publisher:
            row.publisherId !== null && row.publisherName !== null
                ? { id: row.publisherId, name: row.publisherName }
                : null,
    };
}

function baseGamesQuery(db: Database) {
    return db
        .select(gameSelection)
        .from(games)
        .leftJoin(categories, eq(games.categoryId, categories.id))
        .leftJoin(publishers, eq(games.publisherId, publishers.id));
}

function normalizeCategoryIds(categoryIds: number[] | undefined): number[] {
    if (!categoryIds) {
        return [];
    }
    const uniqueIds = new Set<number>();
    for (const categoryId of categoryIds) {
        if (Number.isInteger(categoryId) && categoryId > 0) {
            uniqueIds.add(categoryId);
        }
    }
    return [...uniqueIds];
}

function normalizePublisherId(publisherId: number | undefined): number | null {
    if (typeof publisherId !== 'number' || !Number.isInteger(publisherId) || publisherId <= 0) {
        return null;
    }
    return publisherId;
}

function buildFilterConditions(filters: GameFilters): SQL[] {
    const conditions: SQL[] = [];
    const categoryIds = normalizeCategoryIds(filters.categoryIds);
    const publisherId = normalizePublisherId(filters.publisherId);

    if (categoryIds.length > 0) {
        conditions.push(inArray(games.categoryId, categoryIds));
    }
    if (publisherId !== null) {
        conditions.push(eq(games.publisherId, publisherId));
    }

    return conditions;
}

/**
 * Retrieves all games ordered alphabetically by title.
 *
 * @param db - Injectable Drizzle database instance used to run the query.
 * @returns A promise resolving to all games sorted by title ascending.
 */
export async function getAllGames(db: Database): Promise<Game[]> {
    return getGamesByFilters(db, {});
}

/**
 * Retrieves games filtered by category and/or publisher, ordered alphabetically by title.
 *
 * @param db - Injectable Drizzle database instance used to run the query.
 * @param filters - Optional category and publisher filters.
 * @returns A promise resolving to filtered games sorted by title ascending.
 */
export async function getGamesByFilters(db: Database, filters: GameFilters): Promise<Game[]> {
    const conditions = buildFilterConditions(filters);
    const query = conditions.length > 0
        ? baseGamesQuery(db).where(and(...conditions))
        : baseGamesQuery(db);
    const rows = await query.orderBy(asc(games.title));
    return rows.map((row) => mapGame(row));
}

/**
 * Retrieves all game IDs ordered alphabetically by title.
 *
 * @param db - Injectable Drizzle database instance used to run the query.
 * @returns A promise resolving to game IDs sorted by title ascending.
 */
export async function getAllGameIds(db: Database): Promise<number[]> {
    const rows = await db.select({ id: games.id }).from(games).orderBy(asc(games.title));
    return rows.map((row) => row.id);
}

/**
 * Retrieves a single game by its primary key.
 *
 * @param db - Injectable Drizzle database instance used to run the query.
 * @param id - Primary key of the game row.
 * @returns A promise resolving to the game when found, otherwise `null`.
 */
export async function getGameById(db: Database, id: number): Promise<Game | null> {
    const row = await baseGamesQuery(db).where(eq(games.id, id)).get();
    return row ? mapGame(row) : null;
}
