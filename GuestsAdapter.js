'use strict';

const axios = require('axios');
const config = require('config');
const { commonErrors } = require('../common');
const GuestsUtils = require('./GuestsUtils');
const msGuestsConnector = require('./MsGuestsConnector');

const guestsUtils = new GuestsUtils();

const commonSearchQs = {
  'sort': 'ctimestamp',
  'limit': 200,
};

const MATCH_LINK_SOURCE_ID = config.get('matchLink.sourceId');

class GuestsAdapter {

  async retrieveById(id, correlationId) {
    const response = await msGuestsConnector.get(`/guests/${id}`, {
      'headers': { 'x-global-transaction-id': correlationId },
      'transformResponse': axios.defaults.transformResponse.concat((data, headers) => {
        data.id = id;
        data.rev = headers.etag;
        return data;
      }),
    });
    return response.data;
  }

  async search(filter, correlationId) {
    const response = await msGuestsConnector.get('/guests', {
      'headers': { 'x-global-transaction-id': correlationId },
      'params': {
        ...filter,
        ...commonSearchQs,
      },
    });
    return response.data;
  }

  searchByEmail(emailAddress, filter, correlationId) {
    return this.search({
      ...filter,
      'email_address': emailAddress,
    }, correlationId);
  }

  searchByPhone(phoneNumber, filter, correlationId) {
    const phoneNumberExtract = guestsUtils.extractPhoneNumber(phoneNumber, config.get('guests.extractPhoneNumberBy'));
    return this.search({
      ...filter,
      'phone_number': phoneNumberExtract,
    }, correlationId);
  }

  searchByMarketingId(marketingId, filter, correlationId) {
    return this.search({
      ...filter,
      'marketing_id': marketingId,
    }, correlationId);
  }

  searchByName(guest, filter, correlationId) {
    if (!guest.firstName || !guest.lastName) {
      throw new commonErrors.NotFound('No firstName or lastName found', `firstName: ${guest.firstName}, lastName: ${guest.lastName}`);
    }
    const nameQueries = this.constructNameQuery(guest);
    return this.search({ ...filter, ...nameQueries }, correlationId);
  }

  async patch(requestBody, correlationId) {
    const response = await msGuestsConnector.patch('/guests', requestBody, {
      'headers': {
        'x-global-transaction-id': correlationId,
        'x-source-id': MATCH_LINK_SOURCE_ID,
      },
    });
    return response.data;
  }

  constructNameQuery(guest) {
    // Include altNames array
    const firstNameArray = [guest.firstName, ...guest.altNames];
    const lastNameArray = [guest.lastName];
    // Add fuzzy only when length is more than 3
    if (guest.firstName.length >= 3) {
      firstNameArray.push(`${guest.firstName}~`);
    }
    if (guest.lastName.length >= 3) {
      lastNameArray.push(`${guest.lastName}~`);
    }
    return {
      'first_name': firstNameArray.join(','),
      'last_name': lastNameArray.join(','),
    };
  }
}

module.exports = GuestsAdapter;
