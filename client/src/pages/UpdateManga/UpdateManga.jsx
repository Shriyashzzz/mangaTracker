import { useParams } from "react-router";
import styles from "./UpdateManga.module.css";

export function UpdateManga() {
  const { id } = useParams();
  console.log(id);
  return <>Hi this is where your manga will be updated</>;
}
