// non-primitives (objects)
const username = {
    "first Name": "Anshu", 
    isLoggedIn:true,
}; 
// the object is constatnt but the properties can be changed
username["first Name"] = "Anshul";
username.isLoggedIn = false;
username.lastName = "Kumar"; // adding new property

const MyFirstName="Anshu";

console.log(username["first Name"]); // Anshu
console.log(username.isLoggedIn); // false
console.log(username); // { firstName: 'Anshul', isLoggedIn: false }
console.log(typeof username); // object

let today = new Date();
console.log(today); // current date and time
console.log(today.getDate()); 


//array

//let heros = ["ironman", "spiderman", "thor"]
let anotherUser = ["Ayush", "kumar", true]
anotherUser[0] = "Ayushman"
console.log(anotherUser[0]);

// type conversions
let isValue = true;
console.log(1+"2"); // "12"
console.log(isValue+1); // 2
console.log("5"*2); // 10
console.log("5"+2); // 52
console.log("5"-2); // 3
console.log("hello"+2);
let isValue2="2abc"
console.log(Number(isValue2)); // NaN
console.log(typeof Number(isValue2)); // number
console.log(typeof NaN); // number
console.log(Number(null)); // 0
console.log(Number(undefined)); // NaN