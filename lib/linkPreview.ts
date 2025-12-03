import axios from "axios";
import cheerio from "cheerio";

export async function getLinkPreview(url: string) {
  const res = await axios.get(url, {
    timeout: 5000,
    headers: {
      "User-Agent": "SlackBot/1.0 ChatBot",
    },
  });

  const $ = cheerio.load(res.data);

  return {
    url,
    title: $('meta[property="og:title"]').attr("content") || $("title").text(),
    description:
      $('meta[property="og:description"]').attr("content") ||
      $('meta[name="description"]').attr("content") ||
      "",
    image: $('meta[property="og:image"]').attr("content") || "",
    siteName: $('meta[property="og:site_name"]').attr("content") || "",
  };
}