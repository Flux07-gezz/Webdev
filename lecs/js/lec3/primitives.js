// number 
let balance = 102.322;
let ndBalance = new Number(5000);

console.log(balance); // 102.322
console.log(ndBalance); // [Number: 5000]
console.log(ndBalance.valueOf()); // 5000

console.log(typeof balance); // number
console.log(typeof ndBalance); // object

// so every premitive has a corresponding object wrapper
// string -> String 
// boolean -> Boolean
// symbol -> Symbol
// bigint -> BigInt
// null -> no object wrapper
// undefined -> no object wrapper
// so we can convert primitives to objects using their constructors

//boolean 
let isLoggedIn = true;
let isAdmin = new Boolean(false); // no recommended
console.log(isLoggedIn); // true
console.log(isAdmin); // [Boolean: false]
console.log(isAdmin.valueOf()); // false

// null and undefined 
let firstName ;
console.log(firstName); // undefined

let lastName = null;
console.log(lastName); // null
let lastname = undefined;
console.log(lastname); // undefined

// string 
let message = "Welcome to JavaScript!"
let sndway= 'hello world'
let rdway= `hi there!`

let oldWay = message + " Have a nice day.";
console.log(oldWay); // Welcome to JavaScript! Have a nice day.

let newWay = `!! ${message} Have a nice day !!`;
console.log(newWay); // !! Welcome to JavaScript! Have a nice day !!

let demoString = `value is ${42 + 8}`;
console.log(demoString); // value is 50

//symbol
let sym1 = Symbol("mySymbol"); // only way to create symbols
let sym2 = Symbol("mySymbol");
console.log(sym1 == sym2); // false

let sym3 = Symbol("anshu");
let sym4 = Symbol("anshu");
console.log(sym3 == sym4); //false
console.log(typeof sym1); // symbol
console.log(sym1); // Symbol(mySymbol)
// symbols are unique and immutable always tho they have same name/description

