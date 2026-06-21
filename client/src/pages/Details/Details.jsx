import { useEffect } from "react";
import styles from "./Details.module.css";
import { useState } from "react";
import { useParams } from "react-router";
export default function ({ mangaId }) {
  const [mangaData, setMangData] = useState({});
  const { id } = useParams();
  useEffect(() => {
    async function getManga() {
      const data = await fetch(`${import.meta.VITE_API_URL}/details/${id}`);
      console.log(data);
    }

    getManga();
  }, []);

  return <></>;
}
