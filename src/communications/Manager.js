import uid from 'uid2'
import WebRTC from './WebRTC';
import Round from './Round';
import DataProcessor from './DataProcessor';
import ID from './ID';
import { startRound } from '../redux/actions';
import store from '../redux/store';

export default class Manager {
  static instance = null;

  static getInstance(roomId, userName, randomSuffix) {
    if (Manager.instance === null || Manager.instance.webRTC.peerId.roomId !== roomId) {
      Manager.instance = new Manager(new ID(roomId, userName, randomSuffix));
    }
    return Manager.instance;
  }

  constructor(id) {
    this.dataProcessor = new DataProcessor(this.getState.bind(this), this.doTheThing.bind(this));
    this.webRTC = new WebRTC(id, this.dataProcessor);
    this.round = null;
    this.confirmationIds = null;
    this.readyForNewRound = true;
    console.log('NEW MANAGER CREATED');
  }

  prepareToStartNewRound(text) {
    // TODO check if you are connected to everyone
    if (this.round !== null) {
      console.error('Cannot start new round before finishing previous one');
      return;
    }
    this.round = new Round(text, this.webRTC.peerId, this.webRTC.getConnected(), uid(10, undefined));
    this.confirmationIds = [];
    console.log('Starting new round');
    console.log(this.round);
    this.webRTC.sendToPeers(this.round.ids, { type: DataProcessor.NEW_TEXT, payload: { round: this.round} });
  }

  tryToStartRound() {
    console.log('try to start round');
    if (!this.round || this.webRTC.peerId !== this.round.leaderId || !this.readyForNewRound) {
      console.log('Cannot start round');
      return;
    }
    console.log(this.round, this.confirmationIds, this.round.ids);
    if (this.round.ids.every(id => this.confirmationIds.includes(id))) {
      this.startRound();
    }
  }

  startRound() {
    const time = new Date().getTime() + 4 * 1000;
    const ids = new Set(this.round.ids);
    ids.add(this.webRTC.peerId.getId());
    this.round.ids = Array.from(new Set(ids));
    this.readyForNewRound = false;
    this.webRTC.sendToPeers(this.round.ids, { type: DataProcessor.TIME, payload: {time, round: this.round }});

    const competitorIds = new Set(this.round.ids);
    competitorIds.add(this.round.leaderId.getId());
    console.log('START Round dispatching');
    store.dispatch(startRound({text: this.round.text.text, time, ids: Array.from(competitorIds).map(x => ID.fromString(x))}));
  }

  finishRound() {
    this.round = null;
    this.readyForNewRound = true;
  }

  sendProgress(progress) {
    if (!this.round){
      return;
    }
    this.webRTC.sendToPeers(this.round.ids,
      {type: DataProcessor.TEXT_PROGRESS, payload: {id: this.webRTC.peerId.getId(), progress: progress}})
  }

  getState() {
    return {
      webRTC: this.webRTC,
      round: this.round,
      confirmationIds: this.confirmationIds,
      readyForNewRound: this.readyForNewRound
    }
  }

  doTheThing(thingsToDo) {
    if (!thingsToDo) {
      return;
    }
    if (thingsToDo.newRound !== null) {
      this.round = thingsToDo.newRound
    }
    if (thingsToDo.confirmationIds !== null) {
      this.confirmationIds = thingsToDo.confirmationIds;
    }
    if (thingsToDo.readyForNewRound !== null) {
      this.readyForNewRound = thingsToDo.readyForNewRound;
    }
    if (thingsToDo.send !== null) {
      this.webRTC.sendToPeers(thingsToDo.send.ids, thingsToDo.send.message)
    }
    if (thingsToDo.tryToStartRound !== null && thingsToDo.tryToStartRound) {
      this.tryToStartRound();
    }
  }
}
