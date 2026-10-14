import {createFileRoute, Outlet} from "@tanstack/react-router";
export const Route=createFileRoute("/admin")({component:Outlet,head:()=>({meta:[{name:"robots",content:"noindex, nofollow"},{title:"Commerce admin — Avaruchi"},{name:"description",content:"Manage Avaruchi products, variants, inventory, orders, customers and commerce integrations."}]})});
