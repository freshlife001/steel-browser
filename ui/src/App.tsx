import "@fontsource/inter";
import "@radix-ui/themes/styles.css";
import { client } from "@/steel-client";
import { env } from "@/env";
import AppRouter from "./router";

client.setConfig({
  baseUrl: env.VITE_API_URL,
});

function App() {
  return <AppRouter />;
}

export default App;
