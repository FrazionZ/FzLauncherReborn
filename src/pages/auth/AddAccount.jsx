import React, { Fragment, useState, useRef } from "react" 
import { BsMicrosoft } from 'react-icons/bs'
import FzVariable from '../../components/FzVariable';
import Alert from '../../components/Alert'
import axios from 'axios';
import FzToast from "../../components/FzToast";
import { invoke } from '@tauri-apps/api/tauri'
import { useLocation } from "wouter";
import { useFzContext } from "../../FzContext";

const MICROSOFT_AUTHORIZATION_ENDPOINT = "https://login.live.com/oauth20_authorize.srf";
const MICROSOFT_TOKEN_ENDPOINT = "https://login.live.com/oauth20_token.srf";
const MICROSOFT_REDIRECTION_ENDPOINT = "https://login.live.com/oauth20_desktop.srf";
const XBOX_LIVE_AUTH_HOST = "user.auth.xboxlive.com";
const XBOX_LIVE_CLIENT_ID = "000000004420578E";
const XBOX_LIVE_SERVICE_SCOPE = "service::user.auth.xboxlive.com::MBI_SSL";
const XBOX_LIVE_AUTHORIZATION_ENDPOINT = "https://user.auth.xboxlive.com/user/authenticate";
const XSTS_AUTHORIZATION_ENDPOINT = "https://xsts.auth.xboxlive.com/xsts/authorize";
const MINECRAFT_AUTH_ENDPOINT = "https://api.minecraftservices.com/authentication/login_with_xbox";
const XBOX_LIVE_AUTH_RELAY = "http://auth.xboxlive.com";
const MINECRAFT_AUTH_RELAY = "rp://api.minecraftservices.com/";
const MINECRAFT_STORE_ENDPOINT = "https://api.minecraftservices.com/entitlements/mcstore";
const MINECRAFT_PROFILE_ENDPOINT = "https://api.minecraftservices.com/minecraft/profile";
const MINECRAFT_STORE_IDENTIFIER = "game_minecraft";
const URL_OBTAIN_TOKEN = MICROSOFT_AUTHORIZATION_ENDPOINT + "?client_id=" + XBOX_LIVE_CLIENT_ID + "&redirect_uri=" + MICROSOFT_REDIRECTION_ENDPOINT + "&scope=" + XBOX_LIVE_SERVICE_SCOPE + "&response_type=token";

export default function AddAccount(props) {

    const fzContext = useFzContext()
    const fzVariable = new FzVariable()
    const [location, setLocation] = useLocation()
    const [processAuth, setProcessAuth] = useState(false)

    const startMSA = async () => {

        setProcessAuth(true)
        invoke('authenticate_microsoft').then(async(response) => {
            console.log(response)
            await invoke('create_session', { sessionId: "msa_session", mcSession: response })
            await fzContext.sessionMSA.update()
            setLocation('/connected')
            FzToast.success(`Bienvenue ${response.name} !`)
        })
        .catch((err) => {
            FzToast.error(err)
        })
        .finally(() => {
            setProcessAuth(false)
        })
    }

    function StringFormat(format) {
        var args = Array.prototype.slice.call(arguments, 1);
        return format.replace(/{(\d+)}/g, function (match, number) {
            return typeof args[number] != 'undefined'
                ? args[number]
                : match
                ;
        });
    };

    function closeModal() {
        setIsOpen(false);
    }

    async function openModal() {
        await setIsOpen(true);
    }

    async function loginTokens(access_token, refresh_token) {
        var instance = this;
        let xboxLiveResponse;
        let xstsResponse;
        let minecraftResponse;
        let minecraftProfile;
        return new Promise(async (resolve, reject) => {
            try {
                await axios({
                    method: 'post',
                    url: XBOX_LIVE_AUTHORIZATION_ENDPOINT,
                    data: {
                        Properties: {
                            AuthMethod: "RPS",
                            SiteName: XBOX_LIVE_AUTH_HOST,
                            RpsTicket: access_token
                        },
                        RelyingParty: XBOX_LIVE_AUTH_RELAY,
                        TokenType: 'JWT'
                    }
                }).then((result) => {
                    xboxLiveResponse = result.data;
                }).catch((error) => {
                    reject(error)
                })
                await axios({
                    method: 'post',
                    url: XSTS_AUTHORIZATION_ENDPOINT,
                    data: {
                        Properties: {
                            SandboxId: "RETAIL",
                            UserTokens: [xboxLiveResponse.Token],
                        },
                        RelyingParty: MINECRAFT_AUTH_RELAY,
                        TokenType: 'JWT'
                    }
                }).then((result) => {
                    xstsResponse = result.data;
                }).catch((error) => {
                    reject(error)
                })

                const userHash = xstsResponse.DisplayClaims.xui[0].uhs;
                const MINECRAFT_AUTH_ENDPOINT_POST = {
                    identityToken: StringFormat("XBL3.0 x={0};{1}", userHash, xstsResponse.Token),
                    ensureLegacyEnabled: 'true',
                };

                const minecraftAuthEndpoint = await fetch(MINECRAFT_AUTH_ENDPOINT, { method: 'post', headers: { "Content-Type": "application/json" }, body: JSON.stringify(MINECRAFT_AUTH_ENDPOINT_POST) });
                minecraftResponse = await minecraftAuthEndpoint.json();

                const resultMinecraftStoreEndpoint = await fetch(MINECRAFT_STORE_ENDPOINT, { method: 'get', headers: { "Content-Type": "application/json", "Authorization": `Bearer ${minecraftResponse.access_token}` } });
                const mcStoreData = await resultMinecraftStoreEndpoint.json();

                const gameMinecraft = mcStoreData.items.find(element => element.name == MINECRAFT_STORE_IDENTIFIER);
                if (gameMinecraft !== null || gameMinecraft !== undefined) {
                    const minecraftProfileEndpoint = await fetch(MINECRAFT_PROFILE_ENDPOINT, { method: 'get', headers: { "Content-Type": "application/json", "Authorization": `Bearer ${minecraftResponse.access_token}` } });
                    minecraftProfile = await minecraftProfileEndpoint.json();
                    fzVariable.store.set('msa', { accessToken: minecraftResponse.access_token, refreshToken: refresh_token })
                    resolve({ mcProfile: minecraftProfile, mcResponse: minecraftResponse });
                }
            } catch (error) {
                reject(error)
            }
        })
    }

    async function logProfileFromToken(profile) {
        document.querySelector('.listProfiles').classList.add('hide');
        document.querySelector('.verifyAccount').classList.remove('hide');
        loginRefreshTokens(profile).then(async (logProfile) => {
            await axios.get('https://api.frazionz.net/user/' + logProfile.mcProfile.id + '/account').then((response) => {
                const frazionProfile = response.data;
                sessionStorage.setItem('fzProfile', JSON.stringify({ frazionProfile }))
                sessionStorage.setItem('mcProfile', JSON.stringify({ logProfile }))
                appRouter.showPage('/connected')
            }).catch((err) => {
                console.log(err)
                fzVariable.store.delete('msa');
                parentClass.router.reloadRenderPage('/addAccount')
                FzToast.error("Vous n'avez pas de compte FrazionZ lié à Minecraft. Connectez-vous à Frazionz.net et faites la liaison.")
            })
        }).catch((err) => {
            console.log(err)
            fzVariable.store.delete('msa');
            parentClass.router.reloadRenderPage('/addAccount')
            FzToast.error("Une erreur est survenue lors de la connexion au compte Microsoft")
        })
    }

    async function loginRefreshTokens(profile) {
        return new Promise(async (resolve, reject) => {
            try {
                const microsoftTokenEndpoint = "https://login.live.com/oauth20_token.srf?client_id=" + XBOX_LIVE_CLIENT_ID + "&grant_type=refresh_token&refresh_token=" + profile.refresh_token + "&scope=" + XBOX_LIVE_SERVICE_SCOPE
                const responseMicrosoftTokenEndpoint = await fetch(microsoftTokenEndpoint, { method: 'get', headers: { "Content-Type": "application/x-www-form-urlencoded" } });
                const microsoftRefreshResponse = await responseMicrosoftTokenEndpoint.json();
                fzVariable.store.set('msa', { accessToken: microsoftRefreshResponse.access_token, refreshToken: microsoftRefreshResponse.refresh_token })
                await loginTokens(microsoftRefreshResponse.access_token, microsoftRefreshResponse.refresh_token).then((profile) => {
                    const logProfile = { "id": profile.mcProfile.id, "name": profile.mcProfile.name, "refresh_token": microsoftRefreshResponse.refresh_token }
                    fzProfile.saveProfile(logProfile)
                    resolve({ mcProfile: profile.mcProfile, mcResponse: profile.mcResponse });
                })
            } catch (error) {
                reject(error)
            }
        })
    }
    return (
        <>
            {processAuth ? 
                <div className="verifyAccount flex align-center justify-center h-[inherit]">
                    <div className="flex items-center justify-center gap-30">
                        <div className="loader-3"></div>
                        <div className="flex flex-col">
                            <h6 id="downloadhtml" className="text-xl">
                                Authentification en cours
                            </h6>
                            <h5 id="downloadpercent" className="text-base">
                                En attente de Microsoft..
                            </h5>
                        </div>
                    </div>
                </div>
            :
                <div className="listProfiles flex gap-4 justify-center">
                    <div className="flex items-center flex-col gap-6 px-4">
                        <Alert state="infos" message="Avant de continuer, assurez-vous d'avoir lié votre compte Microsoft avec votre compte FrazionZ" />
                        <button className="btn w-full" onClick={startMSA}><BsMicrosoft /> Se connecter avec Microsoft</button>
                    </div>
                </div>
            }
            
        </>
    )
    //}

}