import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase } from '../../db/test-helpers';
import { categories, publishers, games } from '../../db/schema';
import type { Database } from './db';
import {
    getAllGames,
    getAllGameIds,
    getGamesByFilters,
    getGameById,
} from './games';

async function seedGames(db: Database, count: number): Promise<void> {
    const [category] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'cat' })
        .returning({ id: categories.id });
    const [publisher] = await db
        .insert(publishers)
        .values({ name: 'Pub One', description: 'pub' })
        .returning({ id: publishers.id });

    // Insert titles in reverse-alphabetical order to prove ordering is applied.
    for (let i = count; i >= 1; i--) {
        await db.insert(games).values({
            title: `Game ${String(i).padStart(2, '0')}`,
            description: `Description ${i}`,
            starRating: 4.2,
            categoryId: category.id,
            publisherId: publisher.id,
        });
    }
}

type FilterFixtures = {
    strategyCategoryId: number;
    adventureCategoryId: number;
    pubOneId: number;
    pubTwoId: number;
};

async function seedFilterFixtures(db: Database): Promise<FilterFixtures> {
    const [strategyCategory] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'strategy' })
        .returning({ id: categories.id });
    const [adventureCategory] = await db
        .insert(categories)
        .values({ name: 'Adventure', description: 'adventure' })
        .returning({ id: categories.id });
    const [pubOne] = await db
        .insert(publishers)
        .values({ name: 'Pub One', description: 'pub one' })
        .returning({ id: publishers.id });
    const [pubTwo] = await db
        .insert(publishers)
        .values({ name: 'Pub Two', description: 'pub two' })
        .returning({ id: publishers.id });

    await db.insert(games).values([
        {
            title: 'Alpha Strategy',
            description: 'alpha',
            starRating: 4.5,
            categoryId: strategyCategory.id,
            publisherId: pubOne.id,
        },
        {
            title: 'Beta Adventure',
            description: 'beta',
            starRating: 4.0,
            categoryId: adventureCategory.id,
            publisherId: pubOne.id,
        },
        {
            title: 'Gamma Adventure',
            description: 'gamma',
            starRating: 3.8,
            categoryId: adventureCategory.id,
            publisherId: pubTwo.id,
        },
        {
            title: 'Delta Strategy',
            description: 'delta',
            starRating: 3.6,
            categoryId: strategyCategory.id,
            publisherId: pubTwo.id,
        },
    ]);

    return {
        strategyCategoryId: strategyCategory.id,
        adventureCategoryId: adventureCategory.id,
        pubOneId: pubOne.id,
        pubTwoId: pubTwo.id,
    };
}

describe('games data-access helpers', () => {
    let db: Database;

    beforeEach(async () => {
        db = await createTestDatabase();
    });

    it('returns all games ordered by title', async () => {
        await seedGames(db, 3);
        const all = await getAllGames(db);
        expect(all.map((g) => g.title)).toEqual(['Game 01', 'Game 02', 'Game 03']);
        expect(all[0].category).toEqual({ id: expect.any(Number), name: 'Strategy' });
        expect(all[0].publisher).toEqual({ id: expect.any(Number), name: 'Pub One' });
    });

    it('returns all game ids ordered by title', async () => {
        await seedGames(db, 3);
        const ids = await getAllGameIds(db);
        const all = await getAllGames(db);
        expect(ids).toEqual(all.map((g) => g.id));
    });

    it('fetches a single game by id', async () => {
        await seedGames(db, 2);
        const ids = await getAllGameIds(db);
        const game = await getGameById(db, ids[0]);
        expect(game?.title).toBe('Game 01');
    });

    it('returns null for a non-existent game', async () => {
        await seedGames(db, 2);
        expect(await getGameById(db, 99999)).toBeNull();
    });

    it('filters by one or more categories', async () => {
        const fixtures = await seedFilterFixtures(db);
        const singleCategory = await getGamesByFilters(db, {
            categoryIds: [fixtures.adventureCategoryId],
        });
        expect(singleCategory.map((game) => game.title)).toEqual([
            'Beta Adventure',
            'Gamma Adventure',
        ]);

        const multipleCategories = await getGamesByFilters(db, {
            categoryIds: [fixtures.adventureCategoryId, fixtures.strategyCategoryId],
        });
        expect(multipleCategories.map((game) => game.title)).toEqual([
            'Alpha Strategy',
            'Beta Adventure',
            'Delta Strategy',
            'Gamma Adventure',
        ]);
    });

    it('filters by publisher', async () => {
        const fixtures = await seedFilterFixtures(db);
        const filtered = await getGamesByFilters(db, {
            publisherId: fixtures.pubTwoId,
        });
        expect(filtered.map((game) => game.title)).toEqual([
            'Delta Strategy',
            'Gamma Adventure',
        ]);
    });

    it('combines category and publisher filters', async () => {
        const fixtures = await seedFilterFixtures(db);
        const filtered = await getGamesByFilters(db, {
            categoryIds: [fixtures.adventureCategoryId],
            publisherId: fixtures.pubOneId,
        });
        expect(filtered.map((game) => game.title)).toEqual(['Beta Adventure']);
    });

    it('returns no results when filters do not match games', async () => {
        const fixtures = await seedFilterFixtures(db);
        const filtered = await getGamesByFilters(db, {
            categoryIds: [99999],
            publisherId: fixtures.pubTwoId,
        });
        expect(filtered).toEqual([]);
    });

    it('ignores invalid filter values', async () => {
        await seedFilterFixtures(db);
        const filtered = await getGamesByFilters(db, {
            categoryIds: [0, -1, Number.NaN],
            publisherId: 0,
        });
        const allGames = await getAllGames(db);
        expect(filtered.map((game) => game.id)).toEqual(allGames.map((game) => game.id));
    });
});
