import axios from "axios";
import { CONTACT_ENDPOINT } from "../config/api";

export async function submitContact(payload) {
  const response = await axios.post(CONTACT_ENDPOINT, payload, {
    headers: {
      "Content-Type": "application/json",
    },
  });

  return response.data;
}
