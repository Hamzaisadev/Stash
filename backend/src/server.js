import express from "express"
import { initDatabase } from "./db.js";
import cors from "cors"
import filesRoutes from './routes.js'
import { globalErrorHandler } from "./utils/errors.js";


const app = express();
const PORT = 5000;

//configuring cross origin resource sharing (CORS)
// THIS IS TO RESTRICT THE ORIGIN TO OUR REACT FRONTEND ONLY FOR SECURITY 

app.use(cors({
    origin: "http://localhost:5173",
    credentials: true
}))

//body parsers

app.use(express.json())
app.use(express.urlencoded({extended: true}))



app.get('/', (req, res) => {
    res.send('Stash Server is running ')
})


app.use('/api', filesRoutes)


app.use(globalErrorHandler)
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

