-- seed.sql

INSERT INTO products (name, category, unit, buy_price, sell_price, stock, alert_qty) VALUES
('Haque Chips 40g', 'Chips & Snacks', 'Carton', 480, 600, 45, 10),
('Haque Galaxy Biscuit', 'Biscuits', 'Carton', 320, 420, 60, 15),
('Frutica Juice 200ml', 'Juice & Drinks', 'Carton', 550, 720, 8, 10),
('Mr. Noodles', 'Noodles', 'Carton', 290, 380, 30, 10),
('Pran Candy Mix', 'Candy & Confect.', 'Packet', 150, 200, 120, 20);

INSERT INTO customers (name, phone, area) VALUES
('Alam Store', '01711000001', 'Saidpur Bazar'),
('Karim Traders', '01812000002', 'Nilphamari Road'),
('Roni Mini Mart', '01911000003', 'Saidpur Station');
