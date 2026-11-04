-- Ronald Isley: remove the AI-generated product renders so only real photographs are shown. Idempotent.
delete from product_images
where path in ('/images/isley-open-box.jpg', '/images/isley-box-and-cigar.jpg', '/images/isley-cigar-standing.jpg', '/images/isley-box-closed-gold.jpg', '/images/isley-lounge.jpg')
  and product_id in (select id from products where sku = 'ISLEY-PLUG-60X675-10');
