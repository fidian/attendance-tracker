import { describe, expect, it } from 'vitest';
import { PeopleScreenComponent } from './people-screen.controller';
import type { Person } from '../services/roster.service';

/**
 * The pure parts only -- which bar is showing, and what a form reads back.
 * Nothing here touches a database.
 */
const screen = () =>
    Object.create(PeopleScreenComponent.prototype) as PeopleScreenComponent;

const person = (id: string, display: string, extra = {}): Person => ({
    id,
    display,
    extra,
    present: false,
});

describe('which bar the roster screen shows', () => {
    const people = screen();

    it('offers the add box when nothing is ticked', () => {
        expect(people.showAdd('list', {})).toBe(true);
        expect(people.showSelection('list', {})).toBe(false);
    });

    it('swaps it for the selection bar once somebody is ticked', () => {
        expect(people.showAdd('list', { a: true })).toBe(false);
        expect(people.showSelection('list', { a: true })).toBe(true);
    });

    it('shows neither while the edit form is open', () => {
        expect(people.showAdd('edit', {})).toBe(false);
        expect(people.showSelection('edit', { a: true })).toBe(false);
    });

    it('hides the list behind the edit form', () => {
        expect(people.showEmpty('list', true, [])).toBe(true);
        expect(people.showEmpty('edit', true, [])).toBe(false);
        expect(people.showLoading('list', false)).toBe(true);
        expect(people.showLoading('edit', false)).toBe(false);
    });
});

describe('editing one person', () => {
    const people = screen();

    it('is offered for exactly one', () => {
        expect(people.canEdit({})).toBe(false);
        expect(people.canEdit({ a: true })).toBe(true);
        expect(people.canEdit({ a: true, b: true })).toBe(false);
    });

    it('fills the form from the ticked person', () => {
        const subject = screen();
        subject.busy = false;
        subject.view = 'list';
        subject.people = [
            person('p1', 'Ada L.', { Dept: 'Law' }),
            person('p2', 'Zoe Q.'),
        ];
        subject.selected = { p2: true };
        subject.startEdit();

        expect(subject.view).toBe('edit');
        expect(subject.editId).toBe('p2');
        expect(subject.editName).toBe('Zoe Q.');
    });

    it('copies the answers rather than sharing them', () => {
        const subject = screen();
        const original = person('p1', 'Ada L.', { Dept: 'Law' });
        subject.busy = false;
        subject.people = [original];
        subject.selected = { p1: true };
        subject.startEdit();
        subject.setEditExtra('Dept', 'Auror');

        expect(subject.editExtra.Dept).toBe('Auror');
        expect(original.extra.Dept, 'the roster must not change until saved')
            .toBe('Law');
    });

    it('does nothing when the ticked person has gone', () => {
        const subject = screen();
        subject.busy = false;
        subject.view = 'list';
        subject.people = [];
        subject.selected = { ghost: true };
        subject.startEdit();

        expect(subject.view).toBe('list');
    });

    it('needs a name to save', () => {
        expect(people.canSave('', false)).toBe(false);
        expect(people.canSave('   ', false)).toBe(false);
        expect(people.canSave('Ada', true)).toBe(false);
        expect(people.canSave('Ada', false)).toBe(true);
    });
});

describe('the answer boxes', () => {
    const people = screen();

    it('read an unanswered question as empty, never as "undefined"', () => {
        expect(people.valueFor('Dept', {})).toBe('');
        expect(people.valueFor('Dept', { Dept: 'Law' })).toBe('Law');
    });

    it('appear only while a name is being typed', () => {
        const fields = ['Dept'];

        expect(people.showNewFields('list', {}, fields, '')).toBe(false);
        expect(people.showNewFields('list', {}, fields, '  ')).toBe(false);
        expect(people.showNewFields('list', {}, fields, 'Ada')).toBe(true);
    });

    it('stay hidden for a roster that asks nothing', () => {
        expect(people.showNewFields('list', {}, [], 'Ada')).toBe(false);
    });
});
