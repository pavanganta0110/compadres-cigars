-- Brand order: Compadres Cigars first (header and home tiles list brands by display_order). Idempotent.
update brands set display_order = 1 where slug = 'compadres-cigars';
