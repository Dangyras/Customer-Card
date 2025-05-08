
import { authenticate } from "../shopify.server";
import { Page } from "@shopify/polaris";
import crypto from "crypto";
import { json } from "@remix-run/node";

function isValidProxyRequest(query, secret) {
  const signature = query.get("signature");
  if (!signature) return false;

  const sortedParams = [...query.entries()]
    .filter(([key]) => key !== "signature")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("");

  const hash = crypto
    .createHmac("sha256", secret)
    .update(sortedParams)
    .digest("hex");

  return hash === signature;
}

export async function action({ request }) {
  console.log("----------PROXY----------");
  const { session, admin } = await authenticate.public.appProxy(request);
  const formData = await request.formData();
  const url = new URL(request.url);
  const query = url.searchParams;

  const customerId = `gid://shopify/Customer/${ query.get("logged_in_customer_id") }`;
  const value = formData.get("value") || "";
  
  const SHOPIFY_SECRET = process.env.SHOPIFY_API_SECRET;

  if (!isValidProxyRequest(query, SHOPIFY_SECRET)) {
    return json({ success: false, error: "Invalid signature" }, { status: 403 });
  }

  if (!customerId) {
    console.error("No customerId in session");
    return json({ success: false, error: "Not logged in" }, { status: 401 });
  }
  
  const response = await admin.graphql(`
    mutation UpdateCustomerMetafield {
      customerUpdate(input: {
        id: "${customerId}",
        metafields: [
          {
            namespace: "custom",
            key: "card",
            type: "single_line_text_field",
            value: "${value}"
          }
        ]
      }) {
        customer {
          id
        }
        userErrors {
          field
          message
        }
      }
    }
  `);
  const result = await response.json();
  return json({ success: true, result });
}

export default function Proxy() {
  return (
    <Page>
        Proxy
    </Page>
  );
}