import axios, { AxiosInstance } from "axios"

const coderpointBaseUrl = "https://cloud.coderpoint.ru/api/"

const coderpointInstance: AxiosInstance = axios.create({
    baseURL: coderpointBaseUrl,
    headers: {
        "Content-Type": "application/json",
    },
})

export default coderpointInstance