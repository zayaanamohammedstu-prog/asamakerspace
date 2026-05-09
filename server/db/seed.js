require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('./database');

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function seed() {
  const existingAdmin = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@asahmakerspace.com');
  if (existingAdmin) {
    console.log('Database already seeded. Skipping.');
    return;
  }

  console.log('Seeding database...');

  // --- Users ---
  const adminId = uuidv4();
  const customerId = uuidv4();
  const adminHash = bcrypt.hashSync('admin123', 10);
  const customerHash = bcrypt.hashSync('test123', 10);

  const insertUser = db.prepare(`
    INSERT INTO users (id, name, email, password, role, phone, address)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertUser.run(adminId, 'Admin User', 'admin@asahmakerspace.com', adminHash, 'admin', '+60123456789', 'Kuala Lumpur, Malaysia');
  insertUser.run(customerId, 'Test Customer', 'customer@test.com', customerHash, 'customer', '+60198765432', 'Penang, Malaysia');

  // --- Categories ---
  const categories = [
    { name: 'Arduino & Microcontrollers', description: 'Arduino boards, ESP32, Raspberry Pi and other microcontroller development boards.' },
    { name: '3D Printing',                description: 'FDM 3D printers, resin printers, spare parts and accessories.' },
    { name: 'Sensors & Modules',          description: 'Ultrasonic, temperature, humidity, motion sensors and communication modules.' },
    { name: 'Tools & Equipment',          description: 'Soldering irons, multimeters, oscilloscopes and other maker tools.' },
    { name: 'Materials & Filaments',      description: 'PLA, PETG, ABS, TPU filaments and resin materials for 3D printing.' },
    { name: 'Robotics & Kits',            description: 'Robot kits, chassis, servo motors and complete robotics starter sets.' },
  ];

  const insertCategory = db.prepare(`
    INSERT INTO categories (id, name, slug, description)
    VALUES (?, ?, ?, ?)
  `);

  const categoryIds = {};
  for (const cat of categories) {
    const id = uuidv4();
    const slug = slugify(cat.name);
    insertCategory.run(id, cat.name, slug, cat.description);
    categoryIds[cat.name] = id;
  }

  // --- Products ---
  const products = [
    // Arduino & Microcontrollers
    {
      name: 'Arduino Uno R3 Starter Kit',
      price: 89.90, compare_price: 109.90, stock: 50, featured: 1,
      category: 'Arduino & Microcontrollers',
      description: 'Complete Arduino Uno R3 starter kit with 30+ components including sensors, LEDs, resistors, and a comprehensive project book. Perfect for beginners learning electronics and programming.',
      specifications: { 'Microcontroller': 'ATmega328P', 'Operating Voltage': '5V', 'Digital I/O Pins': '14', 'Analog Input Pins': '6', 'Clock Speed': '16 MHz', 'Components': '30+ pieces' },
    },
    {
      name: 'Arduino Mega 2560',
      price: 65.00, compare_price: 79.00, stock: 35, featured: 0,
      category: 'Arduino & Microcontrollers',
      description: 'Arduino Mega 2560 microcontroller board based on the ATmega2560. It has 54 digital I/O pins, 16 analog inputs, and 4 UARTs — ideal for complex projects requiring many I/O pins.',
      specifications: { 'Microcontroller': 'ATmega2560', 'Operating Voltage': '5V', 'Digital I/O Pins': '54', 'Analog Input Pins': '16', 'Clock Speed': '16 MHz', 'Flash Memory': '256 KB' },
    },
    {
      name: 'ESP32 Development Board',
      price: 25.90, compare_price: 35.00, stock: 80, featured: 1,
      category: 'Arduino & Microcontrollers',
      description: 'Dual-core ESP32 development board with built-in Wi-Fi and Bluetooth. Supports Arduino IDE, MicroPython and ESP-IDF. Great for IoT projects.',
      specifications: { 'CPU': 'Dual-core Xtensa LX6', 'Clock Speed': '240 MHz', 'Wi-Fi': '802.11 b/g/n', 'Bluetooth': 'BT 4.2 + BLE', 'Flash': '4 MB', 'GPIO Pins': '38' },
    },
    {
      name: 'Raspberry Pi 4 Model B 4GB',
      price: 289.00, compare_price: 320.00, stock: 20, featured: 1,
      category: 'Arduino & Microcontrollers',
      description: 'Raspberry Pi 4 Model B with 4GB RAM. Features quad-core ARM Cortex-A72, dual HDMI outputs, USB 3.0, Gigabit Ethernet, and wireless LAN. A full desktop computer on a single board.',
      specifications: { 'CPU': 'Quad-core Cortex-A72 64-bit', 'RAM': '4 GB LPDDR4', 'USB': '2x USB 3.0, 2x USB 2.0', 'Video': 'Dual micro-HDMI 4K', 'Network': 'Gigabit Ethernet + Wi-Fi', 'GPIO': '40-pin header' },
    },
    {
      name: 'Arduino Nano V3.0',
      price: 18.90, compare_price: 25.00, stock: 100, featured: 0,
      category: 'Arduino & Microcontrollers',
      description: 'Compact Arduino Nano V3.0 based on ATmega328P. Small form factor ideal for breadboard prototyping. Compatible with Arduino IDE.',
      specifications: { 'Microcontroller': 'ATmega328P', 'Operating Voltage': '5V', 'Digital I/O Pins': '14', 'Analog Input Pins': '8', 'Clock Speed': '16 MHz', 'Dimensions': '18 x 45 mm' },
    },

    // 3D Printing
    {
      name: 'Ender 3 V2 Neo 3D Printer',
      price: 799.00, compare_price: 899.00, stock: 10, featured: 1,
      category: '3D Printing',
      description: 'Creality Ender 3 V2 Neo FDM 3D printer with CR Touch auto bed levelling, full metal Bowden extruder and a silent mainboard. Build volume 220x220x250mm.',
      specifications: { 'Build Volume': '220 x 220 x 250 mm', 'Layer Resolution': '0.1 – 0.4 mm', 'Print Speed': 'Up to 180 mm/s', 'Filament': '1.75 mm', 'Nozzle Temp': 'Up to 260°C', 'Bed Temp': 'Up to 100°C' },
    },
    {
      name: '3D Printer Nozzle Set (0.2/0.4/0.6/0.8mm)',
      price: 15.90, compare_price: 22.00, stock: 60, featured: 0,
      category: '3D Printing',
      description: 'Set of 4 brass nozzles in 0.2, 0.4, 0.6 and 0.8 mm diameters. Compatible with most FDM printers using MK8 hotends including Ender series.',
      specifications: { 'Material': 'Brass', 'Thread': 'M6', 'Compatible': 'MK8 Hotend', 'Sizes': '0.2 / 0.4 / 0.6 / 0.8 mm', 'Quantity': '4 pieces' },
    },

    // Sensors & Modules
    {
      name: 'Ultrasonic Sensor HC-SR04',
      price: 5.90, compare_price: 9.00, stock: 200, featured: 0,
      category: 'Sensors & Modules',
      description: 'HC-SR04 ultrasonic distance sensor with a range of 2 cm to 400 cm and an accuracy of 3 mm. Works at 5V, compatible with Arduino and Raspberry Pi.',
      specifications: { 'Supply Voltage': '5V DC', 'Ranging Distance': '2 – 400 cm', 'Accuracy': '3 mm', 'Measuring Angle': '15°', 'Trigger Input': '10 µs TTL pulse' },
    },
    {
      name: 'DHT22 Temperature & Humidity Sensor',
      price: 12.90, compare_price: 18.00, stock: 150, featured: 0,
      category: 'Sensors & Modules',
      description: 'DHT22 digital temperature and humidity sensor with high accuracy. Temperature range -40 to 80°C, humidity 0–100% RH. Includes pull-up resistor.',
      specifications: { 'Temperature Range': '-40 to 80°C', 'Humidity Range': '0 – 100% RH', 'Accuracy (Temp)': '±0.5°C', 'Accuracy (Humidity)': '±2% RH', 'Supply Voltage': '3.3 – 5V' },
    },
    {
      name: 'L298N Motor Driver Module',
      price: 14.90, compare_price: 20.00, stock: 90, featured: 0,
      category: 'Sensors & Modules',
      description: 'Dual H-bridge L298N motor driver module capable of driving two DC motors or one stepper motor. Logic input 5V, motor supply 5–35V, maximum 2A per channel.',
      specifications: { 'Driver Chip': 'L298N', 'Motor Voltage': '5 – 35V', 'Logic Voltage': '5V', 'Max Current': '2A per channel', 'Control Signal': '5V TTL' },
    },
    {
      name: 'Servo Motor SG90',
      price: 8.90, compare_price: 13.00, stock: 120, featured: 0,
      category: 'Sensors & Modules',
      description: 'SG90 micro servo motor with 180° rotation. Lightweight at 9g, torque 1.8 kg·cm. Ideal for small robotics, pan-tilt mechanisms and RC projects.',
      specifications: { 'Weight': '9 g', 'Torque': '1.8 kg·cm', 'Rotation': '0 – 180°', 'Operating Voltage': '4.8 – 6V', 'Speed': '0.1 s/60°' },
    },
    {
      name: 'PIR Motion Sensor HC-SR501',
      price: 7.90, compare_price: 12.00, stock: 110, featured: 0,
      category: 'Sensors & Modules',
      description: 'Passive infrared motion sensor with adjustable sensitivity and delay time. Detection range up to 7 m, 110° detection angle. Perfect for security and automation projects.',
      specifications: { 'Supply Voltage': '5 – 20V', 'Detection Range': 'Up to 7 m', 'Detection Angle': '110°', 'Delay Time': '5 s – 5 min (adjustable)', 'Sensitivity': 'Adjustable' },
    },

    // Tools & Equipment
    {
      name: 'Soldering Iron Kit 60W',
      price: 45.00, compare_price: 60.00, stock: 40, featured: 0,
      category: 'Tools & Equipment',
      description: '60W adjustable temperature soldering iron kit. Includes soldering iron, stand, solder wire, flux, desoldering pump and 5 replacement tips. Temperature range 200–450°C.',
      specifications: { 'Power': '60W', 'Temperature Range': '200 – 450°C', 'Tip Type': 'Interchangeable', 'Voltage': '220V AC', 'Includes': 'Iron, stand, solder, flux, pump, 5 tips' },
    },
    {
      name: 'Digital Multimeter DT830D',
      price: 35.00, compare_price: 48.00, stock: 45, featured: 0,
      category: 'Tools & Equipment',
      description: 'DT830D digital multimeter measures AC/DC voltage, DC current, and resistance. Features auto-polarity display, overload protection and data hold. Includes probes and 9V battery.',
      specifications: { 'DC Voltage': '0 – 1000V', 'AC Voltage': '0 – 750V', 'DC Current': '0 – 10A', 'Resistance': '0 – 2 MΩ', 'Display': '3½ digit LCD' },
    },
    {
      name: 'Jumper Wire Set (Male-Male / Male-Female / Female-Female)',
      price: 12.00, compare_price: 18.00, stock: 200, featured: 0,
      category: 'Tools & Equipment',
      description: 'Set of 120 jumper wires in three types: 40x male-to-male, 40x male-to-female, 40x female-to-female. 20 cm length, colour-coded for easy circuit building.',
      specifications: { 'Total Quantity': '120 wires', 'Types': 'M-M, M-F, F-F (40 each)', 'Length': '20 cm', 'Colours': '10 colours per type' },
    },
    {
      name: 'Breadboard 830 Points',
      price: 8.90, compare_price: 13.00, stock: 150, featured: 0,
      category: 'Tools & Equipment',
      description: '830 tie-point solderless breadboard with standard 0.1" spacing. Comes with self-adhesive backing. Fully compatible with DIP ICs and standard component leads.',
      specifications: { 'Tie Points': '830', 'Pitch': '2.54 mm (0.1")', 'Dimensions': '165 x 54 mm', 'Binding': 'Self-adhesive' },
    },

    // Materials & Filaments
    {
      name: '3D Printer PLA Filament 1kg',
      price: 45.00, compare_price: 55.00, stock: 60, featured: 1,
      category: 'Materials & Filaments',
      description: 'High-quality 1 kg spool of 1.75 mm PLA filament. Dimensional accuracy ±0.02 mm. Available in multiple colours. Low warping, easy to print, suitable for beginners.',
      specifications: { 'Material': 'PLA', 'Diameter': '1.75 mm', 'Tolerance': '±0.02 mm', 'Print Temp': '190 – 220°C', 'Bed Temp': '20 – 60°C', 'Net Weight': '1 kg' },
    },
    {
      name: 'PETG Filament 1kg',
      price: 55.00, compare_price: 68.00, stock: 45, featured: 0,
      category: 'Materials & Filaments',
      description: 'Premium PETG filament offering a good balance of strength and flexibility. Moisture resistant, excellent layer adhesion, and food-safe when printed properly.',
      specifications: { 'Material': 'PETG', 'Diameter': '1.75 mm', 'Tolerance': '±0.02 mm', 'Print Temp': '230 – 250°C', 'Bed Temp': '70 – 90°C', 'Net Weight': '1 kg' },
    },
    {
      name: 'ABS Filament 1kg',
      price: 42.00, compare_price: 52.00, stock: 50, featured: 0,
      category: 'Materials & Filaments',
      description: 'ABS filament for durable, heat-resistant prints. Ideal for functional parts, enclosures and outdoor applications. Recommended to use with enclosure printer.',
      specifications: { 'Material': 'ABS', 'Diameter': '1.75 mm', 'Tolerance': '±0.03 mm', 'Print Temp': '220 – 250°C', 'Bed Temp': '90 – 110°C', 'Net Weight': '1 kg' },
    },
    {
      name: 'TPU Flexible Filament 1kg',
      price: 65.00, compare_price: 80.00, stock: 30, featured: 0,
      category: 'Materials & Filaments',
      description: 'Shore 95A TPU flexible filament. Prints phone cases, gaskets, and flexible parts with excellent impact absorption and chemical resistance.',
      specifications: { 'Material': 'TPU', 'Hardness': 'Shore 95A', 'Diameter': '1.75 mm', 'Tolerance': '±0.05 mm', 'Print Temp': '220 – 240°C', 'Net Weight': '1 kg' },
    },

    // Robotics & Kits
    {
      name: 'Robotic Arm Kit 4-DOF',
      price: 185.00, compare_price: 220.00, stock: 15, featured: 1,
      category: 'Robotics & Kits',
      description: '4 degree-of-freedom desktop robotic arm kit. Includes 4x MG996R servo motors, aluminium chassis, and Arduino control board. Programmable via Arduino IDE.',
      specifications: { 'DOF': '4', 'Servos': '4x MG996R', 'Material': 'Aluminium alloy', 'Control': 'Arduino compatible', 'Payload': 'Up to 100g', 'Assembly': 'Required' },
    },
    {
      name: 'Line Following Robot Kit',
      price: 95.00, compare_price: 120.00, stock: 25, featured: 0,
      category: 'Robotics & Kits',
      description: 'Beginner-friendly line following robot kit based on Arduino Uno. Includes IR sensors, L298N motor driver, 2 DC gear motors, chassis, and step-by-step instructions.',
      specifications: { 'Controller': 'Arduino Uno', 'Sensors': 'IR line sensor x3', 'Motor Driver': 'L298N', 'Motors': '2x DC Gear Motor', 'Battery': '18650 x2 (not included)' },
    },
    {
      name: 'ELEGOO Smart Car Robot Kit V3.0',
      price: 159.00, compare_price: 190.00, stock: 18, featured: 1,
      category: 'Robotics & Kits',
      description: 'ELEGOO UNO R3 Project Smart Car Robot Kit with IR remote, Bluetooth, ultrasonic obstacle avoidance, and line tracking. Great for learning robotics and Arduino programming.',
      specifications: { 'Controller': 'UNO R3', 'Functions': 'IR, Bluetooth, Obstacle Avoidance, Line Tracking', 'Connectivity': 'Bluetooth 4.0', 'Power': '18650 batteries x2', 'Skill Level': 'Beginner – Intermediate' },
    },
  ];

  const insertProduct = db.prepare(`
    INSERT INTO products (id, name, slug, description, price, compare_price, stock, category_id, images, specifications, featured, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);

  for (const p of products) {
    insertProduct.run(
      uuidv4(),
      p.name,
      slugify(p.name),
      p.description,
      p.price,
      p.compare_price || null,
      p.stock,
      categoryIds[p.category],
      JSON.stringify([]),
      JSON.stringify(p.specifications || {}),
      p.featured ? 1 : 0
    );
  }

  console.log(`Seeded ${categories.length} categories and ${products.length} products.`);
  console.log('Admin credentials: admin@asahmakerspace.com / admin123');
  console.log('Customer credentials: customer@test.com / test123');
}

seed();
