import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import "./App.css";
import "@css/index.css";
import "@css/style.css";
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
import Login from "./pages/Login";
import { appWindow } from "@tauri-apps/api/window";
import { PrimeReactProvider } from "primereact/api";
import Tailwind from 'primereact/passthrough/tailwind';
import i18n from './I18n';
import { I18nextProvider } from 'react-i18next';


function App() {

  useEffect(() => {
    invoke('center_window', {});
  }, [])

  return (
    <I18nextProvider i18n={i18n}>
      <PrimeReactProvider value={{ unstyled: true, pt: Tailwind }}>
        <FzContextProvider>
          <AppLayout>
            <Switch>
              <Route path="/" component={Updater} />
              <Route path="/login" component={Login} />
              <Route path="/connected" component={LayoutConnect} />
              <Route>404: No such page!</Route>
            </Switch>
          </AppLayout>
        </FzContextProvider>
      </PrimeReactProvider>
    </I18nextProvider>

  );
}

export default App;
