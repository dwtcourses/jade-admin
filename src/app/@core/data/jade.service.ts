import {$WebSocket, WebSocketSendMode} from 'angular2-websocket/angular2-websocket';
import { Http, Response } from '@angular/http';
import { Injectable, OnInit } from '@angular/core';
import 'rxjs/add/operator/map';
import {Observable, Subscriber} from 'rxjs/Rx';
import * as TAFFY from 'taffy';

@Injectable()
export class JadeService {
  private baseUrl: string = 'http://' + window.location.hostname + ':8081';
  private websockUrl: string = 'ws://' + window.location.hostname + ':8083';

  // sockets
  // private websock: WebsocketService;
  private websock: $WebSocket;

  // databases
  private db_agent_agents = TAFFY();

  private db_core_channels = TAFFY();
  private db_core_systems = TAFFY();
  private db_core_modules = TAFFY();

  private db_ob_campaigns = TAFFY();
  private db_ob_destinations = TAFFY();
  private db_ob_dialings = TAFFY();
  private db_ob_dlmas = TAFFY();
  private db_ob_dls = {};
  private db_ob_plans = TAFFY();

  private db_park_parkinglots = TAFFY();
  private db_park_parkedcalls = TAFFY();
  private db_park_settings = TAFFY();

  private db_pjsip_aors = TAFFY();
  private db_pjsip_auths = TAFFY();
  private db_pjsip_contacts = TAFFY();
  private db_pjsip_endpoints = TAFFY();
  private db_pjsip_transports = TAFFY();

  private db_queue_entries = TAFFY();
  private db_queue_members = TAFFY();
  private db_queue_queues = TAFFY();

  private db_vm_users = TAFFY();
  private db_vm_messages = TAFFY();
  private db_vm_settings = TAFFY();

  private targets = [
    ['/agent/agents', this.db_agent_agents],

    ['/core/channels', this.db_core_channels],
    ['/core/systems', this.db_core_systems],
    ['/core/modules', this.db_core_modules],

    ['/ob/campaigns', this.db_ob_campaigns],
    ['/ob/destinations', this.db_ob_destinations],
    ['/ob/dialings', this.db_ob_dialings],
    ['/ob/dlmas', this.db_ob_dlmas],
    // ['/ob/dls', this.db_ob_dls],
    ['/ob/plans', this.db_ob_plans],

    ['/park/parkinglots', this.db_park_parkinglots],
    ['/park/parkedcalls', this.db_park_parkedcalls],
    ['/park/settings', this.db_park_settings],

    ['/pjsip/aors', this.db_pjsip_aors],
    ['/pjsip/auths', this.db_pjsip_auths],
    ['/pjsip/contacts', this.db_pjsip_contacts],
    ['/pjsip/endpoints', this.db_pjsip_endpoints],
    ['/pjsip/transports', this.db_pjsip_transports],

    ['/queue/entries', this.db_queue_entries],
    ['/queue/members', this.db_queue_members],
    ['/queue/queues', this.db_queue_queues],

    ['/voicemail/users', this.db_vm_users],
    ['/voicemail/vms', this.db_vm_messages],
    ['/voicemail/settings', this.db_vm_settings],
  ];


  constructor(private http: Http) {
    console.log('Fired JadeService constructor.');

    this.init_database();
    this.init_websock();
  }

  init_database() {
    for (let i = 0; i < this.targets.length; i++) {
      const target = this.targets[i];
      console.log('Initiating target. ' + target[0]);

      // get data
      this.http.get(this.baseUrl + target[0]).map(res => res.json())
      .subscribe(
        (data) => {
          const list = data.result.list;
          for (let j = 0; j < list.length; j++) {
            target[1].insert(list[j]);
          }
        },
        (err) => {
          console.log('Could not get data. url: ' + target[0] + ' ' + err);
        },
      );
    }
  }

  init_websock() {
    console.log('Fired init_websock.');

    this.websock = new $WebSocket(this.websockUrl);
    this.websock.setSend4Mode(WebSocketSendMode.Direct);
    this.websock.send('{"type":"subscribe", "topic":"/"}');

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

          // console.log('Received topic. topic ', topic);
      },
      {autoApply: false},
    );
  }


  OnInit() {
    console.log('OnInit!!');
    console.log('BaseUrl: ' + this.baseUrl);
  }

  message_handler(j_data) {
    console.log(event);

    const type = Object.keys(j_data)[0];
    const j_msg = j_data[type];

    if (type === 'core.channel.create') {
      this.db_core_channels.insert(j_msg);
    }
    else if (type === 'core.channel.update') {
      this.db_core_channels({unique_id: j_msg['unique_id']}).update(j_msg);
    }
    else if (type === 'core.channel.delete') {
      this.db_core_channels({unique_id: j_msg['unique_id']}).remove();
    }
    else if (type === 'park.parkedcall.create') {
      this.db_park_parkedcalls.insert(j_msg);
    }
    else if (type === 'park.parkedcall.update') {
      this.db_park_parkedcalls({parkee_unique_id: j_msg['parkee_unique_id']}).update(j_msg);
    }
    else if (type === 'park.parkedcall.delete') {
      this.db_park_parkedcalls({parkee_unique_id: j_msg['parkee_unique_id']}).remove();
    }
    else if (type === 'queue.entry.create') {
      this.db_queue_entries.insert(j_msg);
    }
    else if (type === 'queue.entry.update') {
      this.db_queue_entries({unique_id: j_msg['unique_id']}).update(j_msg);
    }
    else if (type === 'queue.entry.delete') {
      this.db_queue_entries({unique_id: j_msg['unique_id']}).remove();
    }

  }






  private get_item(target) {
    if (target === null) {
      return null;
    }

    const target_encode = encodeURI(target);
    return this.http.get(this.baseUrl + target_encode).map(res => res.json());
  }

  private create_item(target, j_data) {
    if (target == null) {
      return false;
    }

    const target_encode = encodeURI(target);

    // create data
    this.http.post(this.baseUrl + target_encode, j_data).map(res => res.json())
    .subscribe(
      (data) => {
        return true;
      },
      (err) => {
        console.log('Error. ' + err);
        return false;
      },
    );
  }

  private update_item(target, j_data) {
    if (target == null) {
      return false;
    }

    const target_encode = encodeURI(target);

    // update data
    this.http.put(this.baseUrl + target_encode, j_data).map(res => res.json())
    .subscribe(
      (data) => {
        return true;
      },
      (err) => {
        console.log('Error. ' + err);
        return false;
      },
    );
  }

  private delete_item(target) {
    if (target === null) {
      return false;
    }

    const target_encode = encodeURI(target);

    // delete data
    this.http.delete(this.baseUrl + target_encode).map(res => res.json())
    .subscribe(
      (data) => {
        return true;
      },
      (err) => {
        console.log('Error. ' + err);
        return false;
      },
    );
  }


  ///// setting

  get_setting(name) {
    if (name === null) {
      return null;
    }

    const target = '/' + name + '/setting';
    return this.get_item(target);
  }

  update_setting(name, data) {
    if (name === null) {
      return null;
    }

    const target = '/' + name + '/setting';
    return this.update_item(target, data);
  }





  //// get items
  get_core_system() {
    return this.db_core_systems;
  }
  get_core_channels() {
    return this.db_core_channels;
  }
  get_core_modules() {
    return this.db_core_modules;
  }

  get_agent_agents() {
    return this.db_agent_agents;
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

    // get data
    this.http.get(this.baseUrl + '/ob/dls', {params: {dlma_uuid: dlma_uuid, count: 1000}})
    .map(res => res.json())
    .subscribe(
      (data) => {
        this.db_ob_dls[dlma_uuid] = TAFFY();
        const db = this.db_ob_dls[dlma_uuid];
        const list = data.result.list;
        for (let i = 0; i < list.length; i++) {
          db.insert(list[i]);
        }
      },
      (err) => {
        console.log('Could not get data. dlma_uuid: ' + dlma_uuid + ' ' + err);
      },
    );
    return this.db_ob_dls[dlma_uuid];
  }
  get_ob_plans() {
    return this.db_ob_plans;
  }

  get_park_parkedcalls() {
    return this.db_park_parkedcalls;
  }
  get_park_parkinglots() {
    return this.db_park_parkinglots;
  }
  get_park_settings() {
    return this.db_park_settings;
  }

  get_pjsip_aors() {
    return this.db_pjsip_aors;
  }
  get_pjsip_auths() {
    return this.db_pjsip_auths;
  }
  get_pjsip_contacts() {
    return this.db_pjsip_contacts;
  }
  get_pjsip_endpoints() {
    return this.db_pjsip_endpoints;
  }

  get_queue_entries() {
    return this.db_queue_entries;
  }










  ////// delete items
  delete_channel(id) {
    return this.delete_item('/core/channels/' + id);
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

  delete_park_parkedcall(id) {
    return this.delete_item('/park/parkedcalls/' + id);
  }
  delete_park_parkinglot(id) {
    return this.delete_item('/park/parkinglot/' + id);
  }
  delete_park_setting(id) {
    return this.delete_item('/park/settings/' + id);
  }

  delete_queue_entry(id) {
    return this.delete_item('/queue/entries/' + id);
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
  create_park_parkinglot(data) {
    return this.create_item('/park/parkinglots', data);
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
  update_park_parkinglot(id, data) {
    return this.update_item('/park/parkinglots/' + id, data);
  }














}
