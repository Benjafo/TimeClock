# Manual Testing Checklist

Run through this in a test server after `npm run deploy` and a bot restart.
Use two accounts where possible: one admin (A) and one regular user (U).
For fast sweep testing, set `REMINDER_HOURS` low (e.g. `1`) and remember the
sweeps run every 5 minutes.

## Setup / migration

- [ ] Start the bot against a pre-upgrade database — boot log is clean and
      `/config view` works (the `user_settings` table is created on startup)
- [ ] `/help` as U shows no Admin section; as A shows both sections

## Config

- [ ] `/config view` shows all six settings, `(default)` markers, and the
      server timezone
- [ ] `/config timezone` autocomplete lists zones; picking one changes how
      `/edit` prefills times; `default` resets it
- [ ] `/config timezone` with a typed invalid zone (e.g. `Foo/Bar`) is
      rejected
- [ ] `/config autoclockoutduration duration:0` reports it as off
- [ ] Settings changed by U do not appear in A's `/config view`

## Clock-in family

- [ ] `/clockin` with no project and no default → helpful error
- [ ] `/setdefaultproject project:X` then `/clockin` → clocks into X
- [ ] `/setdefaultproject` (no args) shows current; `clear:true` clears
- [ ] `/setdefaultproject` rejects a project you aren't assigned to
- [ ] `/clockinlast` clocks into the most recent project; errors with no
      history or when already clocked in
- [ ] `/cancel` → Keep Working keeps the entry; Discard deletes it;
      `/report` shows no trace
- [ ] Clock Out button on the `/clockin` reply still works (and only for
      its owner)

## Add entry

- [ ] `/addentry` (default ui config) opens the picker; Step 1 → Step 2 →
      Save creates the entry; times in `/report` match what was picked
- [ ] Clock-out earlier than clock-in → inline error, picker stays open
- [ ] Notes… button adds a note that appears in the saved entry
- [ ] With `datepicker` + `timepicker` = `textbox`: `/addentry` opens the
      modal instead; invalid text and out-before-in are rejected

## Picker details (via /edit or /editlatest)

- [ ] Date dropdown shows Today/Yesterday labels; **Other date…** accepts an
      old date (e.g. last month) and it becomes the selected option
- [ ] Editing an open entry shows *none (still clocked in)*; saving without
      touching Step 2 keeps it open; **Set clock-out** + Save closes it
- [ ] Mixed config (`datepicker:ui`, `timepicker:textbox` and vice versa)
      shows the **Set date…** / **Set time…** button and it works
- [ ] Cancel closes the picker; clicking a stale picker (after 15+ min)
      reports the session expired
- [ ] Message header always reflects the current selection in your timezone

## Admin

- [ ] `/edit user:@U` as A lists U's entries, edit saves, reply says
      `(for @U)`; same option as U → denied
- [ ] `/deleteentry user:@U` as A works and names the owner
- [ ] `/report user:@U` as A shows U's report; as U → denied
- [ ] `/members project:X`, `/members user:@U`, and both together
- [ ] `/setadmin @U` promotes (U now sees admin commands in `/help`);
      `/removeadmin @U` demotes; removing the only admin is refused

## Sweeps (set REMINDER_HOURS=1 or use short durations)

- [ ] U sets `autoclockoutduration` to 5-10 minutes, clocks in, waits →
      entry closes at clock-in + duration (check `/report`), note says
      `(auto clock-out)`, DM received
- [ ] Long-shift DM arrives past the threshold; no duplicate on later sweeps
- [ ] `longshiftnotification:false` → no long-shift DM
- [ ] `REMINDER_HOURS=0` → no reminder DMs, auto clock-out still works

## Regressions

- [ ] `/clockout`, `/switch`, `/status`, `/projects`, `/summary`,
      `/export` (own + `team:true`), `/forceclockout` all behave as before
- [ ] `/editproject` and `/deleteproject` selects/modals/buttons still work
      (component routing was refactored)
- [ ] Edit-this-entry button on the `/clockout` reply opens the editor
