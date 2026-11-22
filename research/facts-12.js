const listing = 'https://play.google.com/store/apps/details?id=com.nvidia.geforcenow&hl=en_US';
const claim = (section, fields, terms) => ({
  id: 'nvidia-geforce-now', publisher: 'NVIDIA', url: listing, section, claim: fields, terms,
  creation: ['NVIDIA GeForce NOW', 'NVIDIA', 'cloud gaming', 'geforcenow.com'],
});
module.exports = [
  claim('declared', { data: 'Location and personal information', purpose: 'Developer disclosure for the GeForce NOW Android app.' },
    ['GeForce NOW', 'This app may collect these data types', 'Location', 'Personal info']),
  claim('sharesWith', { party: 'Third parties', purpose: 'The developer’s Google Play label declares no data sharing for the Android app.' },
    ['GeForce NOW', 'No data shared with third parties']),
];
