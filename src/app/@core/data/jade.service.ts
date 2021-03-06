import { Injectable, Injector } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { catchError, map } from 'rxjs/operators';
import { of } from 'rxjs/observable/of';


import {$WebSocket, WebSocketSendMode} from 'angular2-websocket/angular2-websocket';
import { Http, Response, RequestOptions, Headers } from '@angular/http';
import { Router } from '@angular/router';
// import { Injectable, OnInit } from '@angular/core';
import 'rxjs/add/operator/map';
import {Observable, Subscriber} from 'rxjs/Rx';
import * as TAFFY from 'taffy';

@Injectable()
export class JadeService {
  private authtoken: string = '';
  private baseUrl: string = 'https://' + window.location.hostname + ':8081/v1';
  private websockUrl: string = 'wss://' + window.location.hostname + ':8083';


  private info: any = {};

  // sockets
  // private websock: WebsocketService;
  private websock: $WebSocket;

  // databases
  private db_agent_agents = TAFFY();

  private db_core_channels = TAFFY();
  private db_core_systems = TAFFY();
  private db_core_modules = TAFFY();

  private db_dp_configs = TAFFY();
  private db_dp_dpmas = TAFFY();
  private db_dp_adps = TAFFY();

  private db_dp_sdps = TAFFY();

  private db_ob_campaigns = TAFFY();
  private db_ob_destinations = TAFFY();
  private db_ob_dialings = TAFFY();
  private db_ob_dlmas = TAFFY();
  private db_ob_dls = {};
  private db_ob_plans = TAFFY();

  private db_park_configs = TAFFY();
  private db_park_parkinglots = TAFFY();
  private db_park_parkedcalls = TAFFY();
  private db_park_cfg_parkinglots = TAFFY();
  // private db_park_settings = TAFFY();

  private db_pjsip_aors = TAFFY();
  private db_pjsip_auths = TAFFY();
  private db_pjsip_configs = TAFFY();
  private db_pjsip_contacts = TAFFY();
  private db_pjsip_endpoints = TAFFY();
  private db_pjsip_transports = TAFFY();

  private db_queue_configs = TAFFY();
  private db_queue_entries = TAFFY();
  private db_queue_members = TAFFY();
  private db_queue_queues = TAFFY();
  private db_queue_cfg_queues = TAFFY();

  private db_sip_configs = TAFFY();
  private db_sip_peers = TAFFY();
  private db_sip_registries = TAFFY();

  private db_user_contacts = TAFFY();
  private db_user_users = TAFFY();
  private db_user_permissions = TAFFY();

  private db_vm_configs = TAFFY();
  private db_vm_users = TAFFY();
  private db_vm_messages = {};

  constructor(private http: HttpClient, private route: Router) {
    console.log('Fired JadeService constructor.');

    if (this.authtoken === '') {
      this.route.navigate(['/login']);
    }
  }

  /**
   * Handle Http operation that failed.
   * Let the app continue.
   * @param operation - name of the operation that failed
   * @param result - optional value to return as the observable result
   */
  private handleError<T> (operation = 'operation', result?: T) {
    return (error: any): Observable<T> => {

      // TODO: send the error to remote logging infrastructure
      console.error(error); // log to console instead

      // TODO: better job of transforming error for user consumption
      this.log(`${operation} failed: ${error.message}`);

      // Let the app keep running by returning an empty result.
      return of(result as T);
    };
  }

  private log(message: string) {
    console.log(message);
  }

  init(): Observable<boolean> {

    const observable = Observable.create(observer => {
      this.htp_get_info().subscribe(
        data => {
          console.log(data);
          this.info = data.result;

          // keep the init order.
          this.init_websock();

          // core
          this.init_core_channel();
          this.init_core_module();
          this.init_core_system();

          // park
          this.init_park_parkedcall();
          this.init_park_parkinglot();
          this.init_park_cfg_parkinglot();
          this.init_park_configuration();

          // user
          this.init_user_user();
          this.init_user_contact();
          this.init_user_permission();

          // queue
          this.init_queue_entry();
          this.init_queue_member();
          this.init_queue_queue();
          this.init_queue_cfg_queue();

          // pjsip
          this.init_pjsip_aor();
          this.init_pjsip_auth();
          this.init_pjsip_contact();
          this.init_pjsip_endpoint();


          // this.init_users();
          // this.init_trunks();
          // this.init_sdialplans();

          observer.next(true);
          observer.complete();
        },
      )
    });

    return observable;
  }

  private init_db(target, db) {
    const url = this.baseUrl +  target + '?authtoken=' + this.authtoken;

    this.http.get<any>(url)
    .pipe(
      map(data => data),
      catchError(this.handleError('Could not initiate db. target: ' + target, [])),
    )
    .subscribe(
      data => {
        console.log(data);

        db().remove();

        const list = data.result.list;
        for(let j = 0; j < list.length; j++) {
          db.insert(list[j]);
        }
      },
    );

  }

  private init_websock() {
    console.log('Fired init_websock.');
    const url = this.websockUrl + '?authtoken=' + this.authtoken;
    console.log("Connecting websocket. url: " + url);

    // init websocket
    this.websock = new $WebSocket(url);

    // set received message callback
    this.websock.onMessage(
      (msg: MessageEvent) => {
          console.log('onMessage ', msg.data);

          // get message
          // {"<topic>": {"<message_name>": {...}}}
          const j_data = JSON.parse(msg.data);
          const topic = Object.keys(j_data)[0];
          const j_msg = j_data[topic];

          // message parse
          this.message_handler(j_msg);
      },
      {autoApply: false},
    );
  }



  private reload_configuration(target, db) {
    const url = '/admin/' + target + '/configurations';

    this.get_item(url)
    .subscribe(
      data => {
        console.log(data);

        db().remove();

        const list = data.result.list;
        for(let j = 0; j < list.length; j++) {
          db.insert(list[j]);
        }
      },
    );
  }

  private delete_configuration(target, detail, db) {
    const url = '/admin/' + target + '/configurations/' + detail;

    this.delete_item(url)
    .subscribe(
      data => {
        this.reload_configuration(target, db);
      }
    )
  }

  private update_configuration(target, detail, data, db) {
    const url = '/admin/' + target + '/configurations/' + detail;

    this.update_item(url, data)
    .subscribe(
      data => {
        this.reload_configuration(target, db);
      }
    )
  }

  set_authtoken(token: string) {
    console.log('Update token. token: ' + token);
    this.authtoken = token;
  }

  /**
   * Login
   */
  login(username, password): Observable<any> {
    let headers: HttpHeaders = new HttpHeaders();

    headers = headers.set("Authorization", "Basic " + btoa(username + ':' + password));
    headers = headers.set("Content-Type", "application/x-www-form-urlencoded");

    const httpOptions = {headers: headers};

    return this.http.post<any>(this.baseUrl + '/admin/login', null, httpOptions)
      .pipe(
        map(res => res),
        catchError(this.handleError<any>('login')),
      );
  }

  logout() {
    const url = this.baseUrl + '/admin/login?authtoken=' + this.authtoken;

    const httpOptions = {
      headers: new HttpHeaders({ 'Content-Type': 'application/json' })
    };

    return this.http.delete<any>(url, httpOptions)
      .pipe(
        map(data => data),
        catchError(this.handleError<any>('logout'))
      )
      .subscribe(
        data => {
          console.log(data);
          this.authtoken = '';
        },
      );
  }

  private htp_get_info(): Observable<any> {
    return this.http.get<any>(this.baseUrl + '/admin/info?authtoken=' + this.authtoken)
    .pipe(
      map(data => data),
      catchError(this.handleError('htp_get_info', [])),
    );
  }

  core_module_handle(name) {
    if (!name) {
      return;
    }
    else if (name === 'app_queue.so') {
      this.db_queue_entries = TAFFY();
      this.db_queue_members = TAFFY();
      this.db_queue_queues = TAFFY();
    }
    else if (name === 'res_parking.so') {
      this.db_park_parkedcalls = TAFFY();
      this.db_park_parkinglots = TAFFY();
    }
    else if (name === 'res_pjsip.so') {
      this.db_pjsip_aors = TAFFY();
      this.db_pjsip_auths = TAFFY();
      this.db_pjsip_contacts = TAFFY();
      this.db_pjsip_endpoints = TAFFY();
      this.db_pjsip_transports = TAFFY();
    }
  }

  OnInit() {
    console.log('OnInit!!');
    console.log('BaseUrl: ' + this.baseUrl);
  }

  message_handler(j_data) {
    console.log(j_data);

    const type = Object.keys(j_data)[0];
    const j_msg = j_data[type];


    if(type === 'admin.core.channel.create') {
      this.db_core_channels.insert(j_msg);
    }
    else if(type === 'admin.core.channel.update') {
      this.db_core_channels({unique_id: j_msg.unique_id}).update(j_msg);
    }
    else if(type === 'admin.core.channel.delete') {
      this.db_core_channels({unique_id: j_msg.unique_id}).remove();
    }
    else if(type === 'admin.core.module.create') {
      this.db_core_modules.insert(j_msg);
    }
    else if(type === 'admin.core.module.update') {
      this.db_core_modules({name: j_msg.name}).update(j_msg);
    }
    else if(type === 'admin.core.module.delete') {
      this.db_core_modules({name: j_msg.name}).remove();
    }
    else if(type === 'admin.core.system.create') {
      this.db_core_systems.insert(j_msg);
    }
    else if(type === 'admin.core.system.update') {
      this.db_core_systems({id: j_msg.id}).update(j_msg);
    }
    else if(type === 'admin.core.system.delete') {
      this.db_core_systems({id: j_msg.id}).remove();
    }
    else if (type === 'admin.park.parkedcall.create') {
      this.db_park_parkedcalls.insert(j_msg);
    }
    else if (type === 'admin.park.parkedcall.update') {
      this.db_park_parkedcalls({parkee_unique_id: j_msg.parkee_unique_id}).update(j_msg);
    }
    else if (type === 'admin.park.parkedcall.delete') {
      this.db_park_parkedcalls({parkee_unique_id: j_msg.parkee_unique_id}).remove();
    }
    else if(type === 'admin.queue.entry.create') {
      this.db_queue_entries.insert(j_msg);
    }
    else if(type === 'admin.queue.entry.delete') {
      this.db_queue_entries({unique_id: j_msg.unique_id}).remove();
    }
    else if(type === 'admin.queue.member.create') {
      this.db_queue_members.insert(j_msg);
    }
    else if(type === 'admin.queue.member.update') {
      this.db_queue_members({id: j_msg.id}).update(j_msg);
    }
    else if(type === 'admin.queue.member.delete') {
      this.db_queue_members({id: j_msg.id}).remove();
    }








    else if (type === 'core.channel.create') {
      this.db_core_channels.insert(j_msg);
    }
    else if (type === 'core.channel.update') {
      this.db_core_channels({unique_id: j_msg.unique_id}).update(j_msg);
    }
    else if (type === 'core.channel.delete') {
      this.db_core_channels({unique_id: j_msg.unique_id}).remove();
    }
    else if (type === 'core.module.update') {
      this.db_core_modules({name: j_msg.name}).update(j_msg);
      const name = j_msg.name;
      this.core_module_handle(name);
    }
    else if (type === 'dp.dialplan.create') {
      this.db_dp_adps.insert(j_msg);
    }
    else if (type === 'dp.dialplan.update') {
      this.db_dp_adps({uuid: j_msg.uuid}).update(j_msg);
    }
    else if (type === 'dp.dialplan.delete') {
      this.db_dp_adps({uuid: j_msg.uuid}).remove();
    }
    else if (type === 'dp.dpma.create') {
      this.db_dp_dpmas.insert(j_msg);
    }
    else if (type === 'dp.dpma.update') {
      this.db_dp_dpmas({uuid: j_msg.uuid}).update(j_msg);
    }
    else if (type === 'dp.dpma.delete') {
      this.db_dp_dpmas({uuid: j_msg.uuid}).remove();
    }
    else if (type === 'pjsip.aor.create') {
      this.db_pjsip_aors.insert(j_msg);
    }
    else if (type === 'pjsip.aor.update') {
      this.db_pjsip_aors({object_name: j_msg.object_name}).update(j_msg);
    }
    else if (type === 'pjsip.aor.delete') {
      this.db_pjsip_aors({object_name: j_msg.object_name}).remove();
    }
    else if (type === 'pjsip.auth.create') {
      this.db_pjsip_auths.insert(j_msg);
    }
    else if (type === 'pjsip.aor.update') {
      this.db_pjsip_auths({object_name: j_msg.object_name}).update(j_msg);
    }
    else if (type === 'pjsip.aor.delete') {
      this.db_pjsip_auths({object_name: j_msg.object_name}).remove();
    }
    else if (type === 'pjsip.contact.create') {
      this.db_pjsip_contacts.insert(j_msg);
    }
    else if (type === 'pjsip.contact.update') {
      this.db_pjsip_contacts({uri: j_msg.uri}).update(j_msg);
    }
    else if (type === 'pjsip.contact.delete') {
      this.db_pjsip_contacts({uri: j_msg.uri}).remove();
    }
    else if (type === 'pjsip.endpoint.create') {
      this.db_pjsip_endpoints.insert(j_msg);
    }
    else if (type === 'pjsip.endpoint.update') {
      this.db_pjsip_endpoints({object_name: j_msg.object_name}).update(j_msg);
    }
    else if (type === 'pjsip.endpoint.delete') {
      this.db_pjsip_endpoints({object_name: j_msg.object_name}).remove();
    }
    else if (type === 'queue.entry.create') {
      this.db_queue_entries.insert(j_msg);
    }
    else if (type === 'queue.entry.update') {
      this.db_queue_entries({unique_id: j_msg.unique_id}).update(j_msg);
    }
    else if (type === 'queue.entry.delete') {
      this.db_queue_entries({unique_id: j_msg.unique_id}).remove();
    }
    else if (type === 'queue.member.create') {
      this.db_queue_members.insert(j_msg);
    }
    else if (type === 'queue.member.update') {
      this.db_queue_members({id: j_msg.id}).update(j_msg);
    }
    else if (type === 'queue.member.delete') {
      this.db_queue_members({id: j_msg.id}).remove();
    }
    else if (type === 'queue.queue.create') {
      this.db_queue_queues.insert(j_msg);
    }
    else if (type === 'queue.queue.update') {
      this.db_queue_queues({name: j_msg.name}).update(j_msg);
    }
    else if (type === 'queue.queue.delete') {
      this.db_queue_queues({name: j_msg.name}).remove();
    }


  }






  private get_item(target, param = null): Observable<any> {
    if (target === null) {
      return null;
    }

    const target_encode = encodeURI(target);
    const url = this.baseUrl + target_encode + '?authtoken=' + this.authtoken;

    const httpOptions = {
      headers: new HttpHeaders({ 'Content-Type': 'application/json' })
    };

    return this.http.get<any>(url, httpOptions)
      .pipe(
        map(res => res),
        catchError(this.handleError<any>('get_item')),
      );
  }

  private create_item(target, j_data): Observable<any> {
    if (target == null) {
      return null;
    }

    const target_encode = encodeURI(target);
    const url = this.baseUrl + target_encode + '?authtoken=' + this.authtoken;

    const httpOptions = {
      headers: new HttpHeaders({ 'Content-Type': 'application/json' }),
    };    

    return this.http.post<any>(url, j_data, httpOptions)
    .pipe(
      map(res => res),
      catchError(this.handleError<any>('create_item')),
    );
  }

  private update_item(target, j_data): Observable<any> {
    if (target == null) {
      return null;
    }
    
    const target_encode = encodeURI(target);

    const url = this.baseUrl + target_encode + '?authtoken=' + this.authtoken;

    const httpOptions = {
      headers: new HttpHeaders({ 'Content-Type': 'application/json' })
    };    

    // update data
    return this.http.put<any>(url, JSON.stringify(j_data), httpOptions)
    .pipe(
      map(data => data),
      catchError(this.handleError<any>('update_item'))
    );
  }

  private delete_item(target): Observable<any> {
    if (target === null) {
      return null;
    }

    const target_encode = encodeURI(target);
    const url = this.baseUrl + target_encode + '?authtoken=' + this.authtoken;

    const httpOptions = {
      headers: new HttpHeaders({ 'Content-Type': 'application/json' }),
    };

    // delete data
    return this.http.delete<any>(url, httpOptions)
      .pipe(
        map(res => res),
        catchError(this.handleError<any>('delete_item')),
      );
  }


  ///// config
  get_config(name) {
    if (name === null) {
      return null;
    }

    const target = '/' + name + '/config';
    return this.get_item(target);
  }

  update_config(name, data) {
    if (name === null) {
      return null;
    }

    const target = '/admin/' + name + '/configurations/' + data.name;
    this.update_item(target, data);


    return this.update_item(target, data);
  }

  delete_config(name, id) {
    if (name === null || id === null) {
      return null;
    }

    const target = '/admin/' + name + '/configurations/' + id;
    return this.delete_item(target);
  }



  ///// settings
  get_settings(name) {
    if (name === null) {
      return null;
    }
    const target = '/' + name + '/settings';
    return this.get_item(target);
  }

  create_settings(name, j_data) {
    if (name === null) {
      return null;
    }
    const target = '/' + name + '/settings';
    return this.create_item(target, j_data);
  }

  update_settings_detail(name, id, j_data) {
    if (name === null) {
      return false;
    }
    const target = '/' + name + '/settings/' + id;
    return this.update_item(target, j_data);
  }

  delete_settings_detail(name, id) {
    if (name === null) {
      return false;
    }
    const target = '/' + name + '/settings/' + id;
    return this.delete_item(target);
  }




  ///// setting

  get_setting(name) {
    if (name === null) {
      return null;
    }

    const target = '/' + name + '/setting';
    return this.get_item(target);
  }

  get_setting_text(name) {
    if (name === null) {
      return null;
    }

    const param = {format: 'text'};

    const target = '/' + name + '/setting';
    return this.get_item(target, param);
  }


  update_setting(name, data) {
    if (name === null) {
      return null;
    }

    const target = '/' + name + '/setting';
    return this.update_item(target, data);
  }

  update_setting_text(name, data) {
    if (name === null) {
      return null;
    }

    const target = '/' + name + '/setting?format=text';
    return this.update_item(target, data);
  }



  //// get items
  get_info() {
    return this.info;
  }

  get_agent_agents() {
    return this.db_agent_agents;
  }


  get_dp_configs() {
    return this.db_dp_configs;
  }
  get_ob_campaigns() {
    return this.db_ob_campaigns;
  }
  get_ob_destinations() {
    return this.db_ob_destinations;
  }
  get_ob_dialings() {
    return this.db_ob_dialings;
  }
  get_ob_dlmas() {
    return this.db_ob_dlmas;
  }
  get_ob_dls(dlma_uuid) {
    if (this.db_ob_dls[dlma_uuid] != null) {
      return this.db_ob_dls[dlma_uuid];
    }

    // // get data
    // this.http.get(this.baseUrl + '/ob/dls', {params: {dlma_uuid: dlma_uuid, count: 1000}})
    // .map(res => res.json())
    // .subscribe(
    //   (data) => {
    //     this.db_ob_dls[dlma_uuid] = TAFFY();
    //     const db = this.db_ob_dls[dlma_uuid];
    //     const list = data.result.list;
    //     for (let i = 0; i < list.length; i++) {
    //       db.insert(list[i]);
    //     }
    //   },
    //   (err) => {
    //     console.log('Could not get data. dlma_uuid: ' + dlma_uuid + ' ' + err);
    //   },
    // );
    return this.db_ob_dls[dlma_uuid];
  }
  get_ob_plans() {
    return this.db_ob_plans;
  }

  get_park_cfgparkinglots() {
    return this.db_park_cfg_parkinglots;
  }

  get_queue_configs() {
    return this.db_queue_configs;
  }


  get_sip_configs() {
    return this.db_sip_configs;
  }
  get_sip_peers() {
    return this.db_sip_peers;
  }
  get_sip_registries() {
    return this.db_sip_registries;
  }


  get_voicemail_configs() {
    return this.db_vm_configs;
  }
  get_voicemail_messages(context, mailbox) {
    if (this.db_vm_messages[mailbox + '@' + context] != null) {
      return this.db_vm_messages[mailbox + '@' + context];
    }

    return this.db_vm_messages[mailbox + '@' + context];
  }
  get_voicemail_users() {
    return this.db_vm_users;
  }



  ///////////////////// core

  // core_module
  private init_core_module() {
    this.init_db('/admin/core/modules', this.db_core_modules);
  }
  get_core_modules() {
    return this.db_core_modules;
  }
  create_core_module(id) {
    this.create_item('/admin/core/modules/' + id, null).subscribe();
  }
  update_core_modue(id) {
    this.update_item('/admin/core/modules/' + id, null).subscribe();
  }
  delete_core_modue(id) {
    this.delete_item('/admin/core/modules/' + id).subscribe();
  }

  // core_channel
  private init_core_channel() {
    this.init_db('/admin/core/channels', this.db_core_channels);
  }
  get_core_channels() {
    return this.db_core_channels;
  }
  delete_core_channel(id) {
    this.delete_item('/admin/core/channels/' + id).subscribe();
  }

  // core_system
  private init_core_system() {
    this.init_db('/admin/core/systems', this.db_core_systems);
  }
  get_core_system() {
    return this.db_core_systems;
  }



  ////////////////////////// dialplan
  // adpmas
  private init_dialplan_adpmas() {
    this.init_db('/admin/dialplan/adpmas', this.db_dp_dpmas);
  }
  reload_dialplan_adpma() {
    this.init_dialplan_adpmas();
  }
  get_dialplan_adpmas() {
    return this.db_dp_dpmas;
  }
  create_dialplan_adpma(data) {
    return this.create_item('/admin/dialplan/adpmas', data).subscribe(res => {this.reload_dialplan_adpma();});
  }
  update_dialplan_adpma(id, data) {
    return this.update_item('/admin/dialplan/adpmas/' + id, data).subscribe(res => {this.reload_dialplan_adpma();});
  }
  delete_dialplan_adpma(id) {
    return this.delete_item('/admin/dialplan/adpmas/' + id).subscribe(res => {this.reload_dialplan_adpma();});
  }

  // adps
  private init_dialplan_adp() {
    this.init_db('/admin/dialplan/adps', this.db_dp_adps);
  }
  reload_dialplan_adp() {
    this.init_dialplan_adp();
  }
  get_dialplan_adps() {
    return this.db_dp_adps;
  }
  create_dialplan_adp(data) {
    return this.create_item('/admin/dialplan/adps', data).subscribe(res => {this.reload_dialplan_adp();});
  }
  update_dialplan_adp(id, data) {
    return this.update_item('/admin/dialplan/adps/' + id, data).subscribe(res => {this.reload_dialplan_adp();});
  }
  delete_dialplan_adp(id) {
    return this.delete_item('/admin/dialplan/adps/' + id).subscribe(res => {this.reload_dialplan_adp();});
  }


  // sdps
  private init_dialplan_sdps() {
    this.init_db('/admin/dialplan/sdps', this.db_dp_sdps);
  }
  reload_dialplan_sdps() {
    this.init_dialplan_sdps();
  }
  get_dialplan_sdps() {
    return this.db_dp_sdps;
  }
  create_dialplan_sdp(data) {
    this.create_item('/admin/dialplan/sdps', data).subscribe(res => {this.reload_dialplan_sdps();});
  }
  update_dialplan_sdp(id, data) {
    this.update_item('/admin/dialplan/sdps/' + id, data).subscribe(res => {this.reload_dialplan_sdps();});
  }
  delete_dialplan_sdp(id) {
    this.delete_item('/admin/dialplan/sdps/' + id).subscribe(res => {this.reload_dialplan_sdps();});
  }

  // configurations
  private init_dialplan_configuration() {
    this.init_db('/admin/dialplan/configurations', this.db_dp_configs);
  }
  reload_dialplan_configuration() {
    this.init_dialplan_configuration();
  }
  get_dialplan_configurations() {
    return this.db_dp_configs;
  }
  update_dialplan_configuration(key, data) {
    this.update_item('/admin/dialplan/configurations/' + key, data).subscribe(res => {this.reload_dialplan_configuration();})
  }
  delete_dialplan_configuration(key) {
    this.delete_item('/admin/dialplan/configurations/' + key).subscribe(res => {this.reload_dialplan_configuration();});
  }


  ////////////////////////// park

  // park_cfg_parkinglots
  private init_park_cfg_parkinglot() {
    this.init_db('/admin/park/cfg_parkinglots', this.db_park_cfg_parkinglots);
  }
  reload_park_cfg_parkinglot() {
    this.init_park_cfg_parkinglot();
  }
  create_park_cfgparkinglot(data) {
    this.create_item('/admin/park/cfg_parkinglots', data).subscribe(res => {this.reload_park_cfg_parkinglot();});
  }
  update_park_cfg_parkinglot(id, data) {
    this.update_item('/admin/park/cfg_parkinglots/' + id, data).subscribe(res => {this.reload_park_cfg_parkinglot();});
  }
  delete_park_cfg_parkinglot(id) {
    this.delete_item('/admin/park/cfg_parkinglots/' + id).subscribe(res => {this.reload_park_cfg_parkinglot();});
  }

  // park_configurations
  private init_park_configuration() {
    this.init_db('/admin/park/configurations', this.db_park_configs);
  }
  reload_park_configuration() {
    this.init_park_configuration();
  }
  get_park_configurations() {
    return this.db_park_configs;
  }
  update_park_configuration(key, data) {
    this.update_item('/admin/park/configurations/' + key, data).subscribe(res => {this.reload_park_configuration();})
  }
  delete_park_configuration(key) {
    this.delete_item('/admin/park/configurations/' + key).subscribe(res => {this.reload_park_configuration();});
  }

  // park_parkedcall
  private init_park_parkedcall() {
    this.init_db('/admin/park/parkedcalls', this.db_park_parkedcalls);
  }
  get_park_parkedcalls() {
    return this.db_park_parkedcalls;
  }
  delete_park_parkedcall(id) {
    this.delete_item('/admin/park/parkedcalls/' + id).subscribe();
  }

  // park_parkinglot
  private init_park_parkinglot() {
    this.init_db('/admin/park/parkinglots', this.db_park_parkinglots);
  }
  get_park_parkinglots() {
    return this.db_park_parkinglots;
  }

  ////////////////////////// user
  // user
  private init_user_user() {
    this.init_db('/admin/user/users', this.db_user_users);
  }
  get_user_users() {
    return this.db_user_users;
  }
  create_user_user(data) {
    this.create_item('/admin/user/users', data).subscribe();
  }
  update_user_user(id, data) {
    this.update_item('/admin/user/users/' + id, data).subscribe();
  }
  delete_user_user(id) {
    this.delete_item('/admin/user/users/' + id).subscribe();
  }

  // contact
  private init_user_contact() {
    this.init_db('/admin/user/contacts', this.db_user_contacts);
  }
  get_user_contacts() {
    return this.db_user_contacts;
  }
  create_user_contact(data) {
    this.create_item('/admin/user/contacts', data).subscribe();
  }
  update_user_contact(id, data) {
    this.update_item('/admin/user/contacts/' + id, data).subscribe();
  }
  delete_user_contact(id) {
    this.delete_item('/admin/user/contacts/' + id).subscribe();
  }

  // permission
  private init_user_permission() {
    this.init_db('/admin/user/permissions', this.db_user_permissions);
  }
  get_user_permissions() {
    return this.db_user_permissions;
  }
  create_user_permission(data) {
    this.create_item('/admin/user/permissions', data).subscribe();
  }
  update_user_permission(id, data) {
    this.update_item('/admin/user/permissions/' + id, data).subscribe();
  }
  delete_user_permission(id) {
    this.delete_item('/admin/user/permissions/' + id).subscribe();
  }


  ////////////////////////// queue
  // queue
  private init_queue_queue() {
    this.init_db('/admin/queue/queues', this.db_queue_queues);
  }
  reload_queue_queue() {
    this.init_queue_queue();
  }
  get_queue_queues() {
    return this.db_queue_queues;
  }

  // member
  private init_queue_member() {
    this.init_db('/admin/queue/members', this.db_queue_members);
  }
  get_queue_members() {
    return this.db_queue_members;
  }
  create_queue_member(data) {
    this.create_item('/admin/queue/members', data).subscribe();
  }
  update_queue_member(id, data) {
    this.update_item('/admin/queue/members/' + id, data).subscribe();
  }
  delete_queue_member(id) {
    this.delete_item('/admin/queue/members/' + id).subscribe();
  }

  // entry
  private init_queue_entry() {
    this.init_db('/admin/queue/entries', this.db_queue_entries);
  }
  get_queue_entries() {
    return this.db_queue_entries;
  }
  delete_queue_entry(id) {
    this.delete_item('/admin/queue/entries/' + id).subscribe();
  }

  // configuration
  private init_queue_configuration() {
    this.init_db('/admin/queue/configurations', this.db_queue_configs);
  }
  reload_queue_configuration() {
    this.init_queue_configuration();
  }
  get_queue_configurations() {
    return this.db_queue_configs;
  }
  update_queue_configuration(key, data){
    this.update_item('/admin/queue/configurations/' + key, data).subscribe(res => {this.reload_queue_configuration();})
  }
  delete_queue_configuration(key) {
    this.delete_item('/admin/queue/configurations/' + key).subscribe(res => {this.reload_queue_configuration();});
  }


  // cfg_queue
  private init_queue_cfg_queue() {
    this.init_db('/admin/queue/cfg_queues', this.db_queue_cfg_queues);
  }
  reload_queue_cfg_queue() {
    this.init_queue_cfg_queue();
  }
  get_queue_cfg_queues() {
    return this.db_queue_cfg_queues;
  }
  create_queue_cfg_queue(data) {
    this.create_item('/admin/queue/cfg_queues', data).subscribe(res => {this.reload_queue_cfg_queue();});
  }
  update_queue_cfg_queue(id, data) {
    this.update_item('/admin/queue/cfg_queues/' + id, data).subscribe(res => {this.reload_queue_cfg_queue();});
  }
  delete_queue_cfg_queue(id) {
    this.delete_item('/admin/queue/cfg_queues/' + id).subscribe(res => {this.reload_queue_cfg_queue();});
  }



  ////////////////////////// pjsip
  // aor
  private init_pjsip_aor() {
    this.init_db('/admin/pjsip/aors', this.db_pjsip_aors);
  }
  get_pjsip_aors() {
    return this.db_pjsip_aors;
  }

  // auth
  private init_pjsip_auth() {
    this.init_db('/admin/pjsip/auths', this.db_pjsip_auths);
  }
  get_pjsip_auths() {
    return this.db_pjsip_auths;
  }

  // contact
  private init_pjsip_contact() {
    this.init_db('/admin/pjsip/contacts', this.db_pjsip_contacts);
  }
  get_pjsip_contacts() {
    return this.db_pjsip_contacts;
  }

  // endpoint
  private init_pjsip_endpoint() {
    this.init_db('/admin/pjsip/endpoints', this.db_pjsip_endpoints);
  }
  get_pjsip_endpoints() {
    return this.db_pjsip_endpoints;
  }

  // configuration
  private init_pjsip_configuration() {
    this.init_db('/admin/pjsip/configurations', this.db_pjsip_configs);
  }
  reload_pjsip_configuration() {
    this.init_pjsip_configuration();
  }
  get_pjsip_configurations() {
    return this.db_pjsip_configs;
  }
  update_pjsip_configuration(key, data){
    this.update_item('/admin/pjsip/configurations/' + key, data).subscribe(res => {this.reload_pjsip_configuration();})
  }
  delete_pjsip_configuration(key) {
    this.delete_item('/admin/pjsip/configurations/' + key).subscribe(res => {this.reload_pjsip_configuration();});
  }









  delete_agent(id) {
    return this.delete_item('/agent/agents/' + id);
  }

  delete_ob_campaign(id) {
    return this.delete_item('/ob/campaigns/' + id);
  }
  delete_ob_destination(id) {
    return this.delete_item('/ob/destinations/' + id);
  }
  delete_ob_dialing(id) {
    return this.delete_item('/ob/dialings/' + id);
  }
  delete_ob_dl(id) {
    return this.delete_item('/ob/dls/' + id);
  }
  delete_ob_dlma(id) {
    return this.delete_item('/ob/dlmas/' + id);
  }
  delete_ob_plan(id) {
    return this.delete_item('/ob/plans/' + id);
  }

  delete_park_setting(id) {
    return this.delete_item('/park/settings/' + id);
  }

  delete_queue_config(id) {
    return this.delete_item('/queue/configs/' + id);
  }








  //// create items



  create_outbound_campaign(data) {
    return this.create_item('/ob/campaigns', data);
  }
  create_outbound_destination(data) {
    return this.create_item('/ob/destinations', data);
  }
  create_outbound_dl(data) {
    return this.create_item('/ob/dls', data);
  }
  create_outbound_dlma(data) {
    return this.create_item('/ob/dlmas', data);
  }
  create_outbound_plan(data) {
    return this.create_item('/ob/plans', data);
  }





  //// update items






  update_outbound_campaign(id, data) {
    return this.update_item('/ob/campaigns/' + id, data);
  }
  update_outbound_destination(id, data) {
    return this.update_item('/ob/destinations/' + id, data);
  }
  update_outbound_dl(id, data) {
    return this.update_item('/ob/dls/' + id, data);
  }
  update_outbound_dlma(id, data) {
    return this.update_item('/ob/dlmas/' + id, data);
  }
  update_outbound_plan(id, data) {
    return this.update_item('/ob/plans/' + id, data);
  }


  update_info(data: any) {
    this.update_item('/admin/info', data).subscribe();
  }













}
