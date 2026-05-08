const fs = require('fs');
const contents = fs.readFileSync('public/models/oversized_tshirt.glb');
// We just want to check the strings in the glb to guess mesh names
const text = contents.toString('utf8');
const names = text.match(/"name":"([^"]+)"/g);
if (names) {
  const uniqueNames = [...new Set(names.map(n => n.split(':"')[1].replace('"', '')))];
  console.log(uniqueNames);
}
