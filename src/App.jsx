import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import "./App.css";
import "./assets/css/index.css";
import "./assets/css/style.css";
import { toast } from "sonner";
import Task from './components/Task'
import { Queue } from 'async-await-queue'
import LayoutConnect from './pages/connected/Layout'
import Updater from './pages/Updater'
import Runtime from './pages/Runtime'
import AppLayout from './pages/AppLayout';
import { Route, Switch } from "wouter";
import FzVariable from "./components/FzVariable";
import { FzContextProvider } from "./FzContext";
import AddAccount from "./pages/auth/AddAccount";
import { appWindow } from "@tauri-apps/api/window";
import { PrimeReactProvider } from "primereact/api";
import Tailwind from 'primereact/passthrough/tailwind';

function App() {

  useEffect(() => {
    invoke('center_window', {});
  }, [])

  return (
    <PrimeReactProvider value={{ unstyled: true, pt: Tailwind }}>
      <FzContextProvider>
        <AppLayout>
          <Switch>
            <Route path="/" component={Updater} />
            <Route path="/runtime" component={Runtime} />
            <Route path="/login" component={AddAccount} />
            <Route path="/connected" component={LayoutConnect} />
            <Route>404: No such page!</Route>
          </Switch>
        </AppLayout>
      </FzContextProvider>
    </PrimeReactProvider>

  );
}

export default App;
