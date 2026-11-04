-- Robusto and Maduro Torpedo boxes of 20: replace the low-resolution box photos with sharp new ones. Idempotent.
update product_images
set path = '/images/compadres-robusto-box-20.png',
    alt = 'Open Compadres Robusto box of 20 with a gold ribbon'
where path = '/images/compadres-robusto-box.jpg';

update product_images
set path = '/images/compadres-maduro-torpedo-box-20.png',
    alt = 'Open Compadres Maduro Torpedo box of 20 with a gold ribbon'
where path = '/images/compadres-maduro-torpedo-box.jpg';
