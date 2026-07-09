import express from "express"
import { initDatabase } from "./db.js";


const app = express();
const PORT = 5000;

app.get('/', (req, res) => {
    res.send('Stash Server is running ')
})
// checking if database actually initiated then only run the server other wise throw the error
// this make sures that the app doesnt fall in data base errors and end the app process at the error of database 
initDatabase()
    .then(() => {
        app.listen(PORT, () => {
            console.log('stash server is running on ' + PORT)
        })
    })
    .catch((err) => {
        console.error('Failed to initialize database on startup', err);
        process.exit(1)
    })

