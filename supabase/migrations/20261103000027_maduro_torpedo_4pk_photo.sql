-- Maduro Torpedo: replace the low-resolution four-pack photo with the new transparent artwork. Idempotent.
update product_images
set path = '/images/compadres-maduro-torpedo-4pk.png',
    alt = 'Compadres Maduro Torpedo cigar standing beside its black four-pack box'
where path = '/images/compadres-maduro-torpedo-pack.jpg';
