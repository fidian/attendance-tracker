/**
 * The roster a brand new database is offered, so there is something to look
 * at before anybody has typed anything in.
 *
 * It is a constant rather than something fetched. The app has no business
 * reaching out to a spreadsheet on somebody else's account to fill an empty
 * database, and a seed that only works online is a seed that fails on the
 * day you need it.
 */
export interface SeedPerson {
    display: string;
    extra: Record<string, string>;
}

/** Import header order, which is what an export has to reproduce. */
export const SEED_COLUMNS = ['First', 'Last', 'Dept'];

export const SEED_PEOPLE: SeedPerson[] = [
    { display: 'Harry P. (Auror)', extra: { First: 'Harry', Last: 'Potter', Dept: 'Auror' } },
    { display: 'Hermione G. (Law)', extra: { First: 'Hermione', Last: 'Granger', Dept: 'Law' } },
    { display: 'Ron W. (Auror)', extra: { First: 'Ron', Last: 'Weasley', Dept: 'Auror' } },
    { display: 'Minerva M. (Mgmt)', extra: { First: 'Minerva', Last: 'McGonagall', Dept: 'Mgmt' } },
    { display: 'Kingsley S. (Exec)', extra: { First: 'Kingsley', Last: 'Shacklebolt', Dept: 'Exec' } },
    { display: 'Arthur W. (Muggles)', extra: { First: 'Arthur', Last: 'Weasley', Dept: 'Muggles' } },
    { display: 'Percy W. (Coop)', extra: { First: 'Percy', Last: 'Weasley', Dept: 'Coop' } },
    { display: 'Nymphadora T. (Auror)', extra: { First: 'Nymphadora', Last: 'Tonks', Dept: 'Auror' } },
    { display: 'Rufus S. (Auror)', extra: { First: 'Rufus', Last: 'Scrimgeour', Dept: 'Auror' } },
    { display: 'Amelia B. (Law)', extra: { First: 'Amelia', Last: 'Bones', Dept: 'Law' } },
    { display: 'Barty C. (Games)', extra: { First: 'Barty', Last: 'Crouch Sr.', Dept: 'Games' } },
    { display: 'Ludo B. (Games)', extra: { First: 'Ludo', Last: 'Bagman', Dept: 'Games' } },
    { display: 'Dolores U. (Exec)', extra: { First: 'Dolores', Last: 'Umbridge', Dept: 'Exec' } },
    { display: 'Lucius M. (Gov)', extra: { First: 'Lucius', Last: 'Malfoy', Dept: 'Gov' } },
    { display: 'Albus D. (Mgmt)', extra: { First: 'Albus', Last: 'Dumbledore', Dept: 'Mgmt' } },
    { display: 'Severus S. (Edu)', extra: { First: 'Severus', Last: 'Snape', Dept: 'Edu' } },
    { display: 'Gilderoy L. (Edu)', extra: { First: 'Gilderoy', Last: 'Lockhart', Dept: 'Edu' } },
    { display: 'Remus L. (Edu)', extra: { First: 'Remus', Last: 'Lupin', Dept: 'Edu' } },
    { display: 'Alastor M. (Auror)', extra: { First: 'Alastor', Last: 'Moody', Dept: 'Auror' } },
    { display: 'Newt S. (Beasts)', extra: { First: 'Newt', Last: 'Scamander', Dept: 'Beasts' } },
    { display: 'Amos D. (Creatures)', extra: { First: 'Amos', Last: 'Diggory', Dept: 'Creatures' } },
    { display: 'Cuthbert M. (Goblins)', extra: { First: 'Cuthbert', Last: 'Mockridge', Dept: 'Goblins' } },
    { display: 'Dirk C. (Goblins)', extra: { First: 'Dirk', Last: 'Cresswell', Dept: 'Goblins' } },
    { display: 'Reginald C. (Maint)', extra: { First: 'Reginald', Last: 'Cattermole', Dept: 'Maint' } },
    { display: 'Mafalda H. (Improper)', extra: { First: 'Mafalda', Last: 'Hopkirk', Dept: 'Improper' } },
];
